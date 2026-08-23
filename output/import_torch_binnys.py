#!/usr/bin/env python3
"""Import Binny's THC tasting schedule as Torch Retail Sampling tracker rows.

Mirrors output/import_torch_twm.py: GraphQL batch import + per-store retailers
for the Account Map. Dedup is store_number + start datetime (importer-native).
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

import requests
from openpyxl import Workbook, load_workbook

GQL = "https://spark-api-new-490085168610.us-central1.run.app/api/v483927/graphql/spark"
SRC_XLSX = Path("/Users/kylechristiansen/Desktop/Binny's THC Tasting Schedule.xlsx")
OUT_DIR = Path("/Users/kylechristiansen/spark-front-client/output")
JSON_PATH = OUT_DIR / "torch_binnys_retail_schedule.json"
GEO_PATH = OUT_DIR / "torch_binnys_geocoded_stores.json"
READY_XLSX = OUT_DIR / "torch_binnys_retail_schedule.ready.xlsx"
TOKEN_PATH = Path("/tmp/spark-jwt.txt")
PHOTON_URL = "https://photon.komoot.io/api/"

TEMPLATE_COLUMNS = [
    "name",
    "date",
    "start_time",
    "end_time",
    "address",
    "store_number",
    "scheduling_status",
    "latitude",
    "longitude",
    "notes",
    "requestor_email",
    "distributor_name",
    "retailer_name",
    "city",
    "state",
    "store_manager_name",
    "store_manager_phone",
    "timezone_code",
    "request_type_id",
    "event_type_id",
    "billing_entity_id",
    "store_manager_id",
    "table_size",
    "product_ids",
]

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ADDR_RE = re.compile(
    r"^(?P<street>.+?)\s+(?P<city>[^,]+),\s*(?P<state>[A-Za-z]{2})\s+(?P<zip>\d{5})(?:-\d{4})?\s*$"
)
# Excel 1900 date system (openpyxl / Excel serial).
EXCEL_EPOCH = datetime(1899, 12, 30)
# US DST 2026 ends 2026-11-01 02:00 local (first Sunday in November).
DST_END_2026 = datetime(2026, 11, 1).date()


def _colrow(ref: str) -> tuple[int, int]:
    col = ""
    row = ""
    for ch in ref:
        if ch.isalpha():
            col += ch
        else:
            row += ch
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n, int(row)


def parse_src_xlsx(path: Path) -> list[dict]:
    z = zipfile.ZipFile(path)
    ss: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            ss.append("".join(t.text or "" for t in si.findall(".//m:t", NS)))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows: dict[int, dict[int, object]] = {}
    for c in sheet.findall(".//m:c", NS):
        ref = c.attrib.get("r")
        if not ref:
            continue
        t = c.attrib.get("t")
        v = c.find("m:v", NS)
        is_el = c.find("m:is", NS)
        val: object | None = None
        if t == "s" and v is not None and v.text:
            val = ss[int(v.text)]
        elif t == "inlineStr" and is_el is not None:
            val = "".join(
                x.text or ""
                for x in is_el.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
            )
        elif v is not None:
            val = v.text
        col, row = _colrow(ref)
        rows.setdefault(row, {})[col] = val

    out: list[dict] = []
    for r in sorted(rows):
        cols = rows[r]
        req = str(cols.get(1) or "").strip()
        if not req.isdigit():
            continue
        serial = cols.get(2)
        store = str(cols.get(4) or "").strip()
        address = str(cols.get(5) or "").strip()
        status = str(cols.get(6) or "").strip()
        availability = str(cols.get(7) or "").strip()
        if not store or not address:
            continue
        try:
            dt = EXCEL_EPOCH + timedelta(days=float(serial))
        except (TypeError, ValueError):
            raise RuntimeError(f"row {r}: bad excel date {serial!r}")
        m = ADDR_RE.match(address)
        if not m:
            raise RuntimeError(f"row {r}: cannot parse address {address!r}")
        city = m.group("city").strip()
        state = m.group("state").strip().upper()
        zipc = m.group("zip").strip()
        slug = re.sub(r"[^A-Z0-9]+", "-", store.upper()).strip("-")
        store_number = f"BINNY-{zipc}"
        tz = "CDT" if dt.date() < DST_END_2026 else "CST"
        out.append(
            {
                "request_no": int(req),
                "name": f"Torch Sampling - Binny's ({store})",
                "date": dt.strftime("%m/%d/%Y"),
                "iso_date": dt.strftime("%Y-%m-%d"),
                "start_time": "17:00",
                "end_time": "20:00",
                "address": address,
                "store": store,
                "store_number": store_number,
                "retailer_name": "Binny's",
                "city": city,
                "state": state,
                "zip": zipc,
                "timezone_code": tz,
                "scheduling_status": "already_scheduled",
                "notes": f"{status} | {availability} | Binny's THC tasting 5–8 PM",
            }
        )
    return out


def photon_geocode(query: str) -> tuple[float, float, str] | None:
    try:
        res = requests.get(
            PHOTON_URL,
            params={"q": query, "limit": 1},
            timeout=15,
            headers={"User-Agent": "spark-front-client/torch-binnys-import"},
        )
        res.raise_for_status()
        feats = (res.json() or {}).get("features") or []
    except (requests.RequestException, ValueError):
        return None
    if not feats:
        return None
    geom = (feats[0] or {}).get("geometry") or {}
    props = (feats[0] or {}).get("properties") or {}
    coords = geom.get("coordinates") or []
    if len(coords) < 2:
        return None
    lng, lat = float(coords[0]), float(coords[1])
    if lat == 0.0 and lng == 0.0:
        return None
    label = props.get("name") or props.get("street") or query
    return lat, lng, str(label)


def geocode_stores(rows: list[dict]) -> list[dict]:
    unique: dict[str, dict] = {}
    for r in rows:
        unique.setdefault(r["store_number"], dict(r))
    stores = []
    for sn, sample in unique.items():
        queries = [
            f"Binny's Beverage Depot {sample['address']}",
            f"Binny's {sample['address']}",
            sample["address"],
        ]
        hit = None
        used = ""
        for q in queries:
            hit = photon_geocode(q)
            used = q
            if hit:
                break
            time.sleep(0.4)
        if not hit:
            print(f"GEO MISS {sn} {sample['address']}", file=sys.stderr)
            stores.append(
                {
                    "store_number": sn,
                    "store": sample["store"],
                    "address": sample["address"],
                    "city": sample["city"],
                    "state": sample["state"],
                    "zip": sample["zip"],
                    "lat": None,
                    "lng": None,
                    "geocode_meta": "miss",
                    "count": sum(1 for r in rows if r["store_number"] == sn),
                }
            )
            continue
        lat, lng, label = hit
        print(f"GEO OK {sn} {sample['store']} {lat},{lng} via {label}")
        stores.append(
            {
                "store_number": sn,
                "store": sample["store"],
                "address": sample["address"],
                "city": sample["city"],
                "state": sample["state"],
                "zip": sample["zip"],
                "lat": lat,
                "lng": lng,
                "geocode_meta": label,
                "count": sum(1 for r in rows if r["store_number"] == sn),
            }
        )
        time.sleep(0.35)
    return stores


def write_artifacts(rows: list[dict], stores: list[dict]) -> None:
    by_sn = {s["store_number"]: s for s in stores}
    for r in rows:
        geo = by_sn.get(r["store_number"]) or {}
        r["latitude"] = geo.get("lat")
        r["longitude"] = geo.get("lng")
    spec = {
        "tenant_name": "Torch THC",
        "tenant_slug": "keee-torch-thc",
        "event_type": "Retail Sampling",
        "request_type": "Retail Sampling",
        "scheduling_status": "already_scheduled",
        "source": str(SRC_XLSX),
        "y_row_count": len(rows),
        "unique_stores": len(stores),
        "rows": rows,
    }
    JSON_PATH.write_text(json.dumps(spec, indent=2))
    GEO_PATH.write_text(
        json.dumps(
            {
                "ok": sum(1 for s in stores if s.get("lat") is not None),
                "miss": sum(1 for s in stores if s.get("lat") is None),
                "stores": stores,
            },
            indent=2,
        )
    )
    print(f"wrote {JSON_PATH} rows={len(rows)} stores={len(stores)}")
    print(f"wrote {GEO_PATH}")


def gql(query: str, variables: dict | None = None, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"JWT {token}"
    res = requests.post(
        GQL,
        headers=headers,
        json={"query": query, "variables": variables or {}},
        timeout=120,
    )
    res.raise_for_status()
    payload = res.json()
    if payload.get("errors"):
        msgs = "; ".join(e.get("message", str(e)) for e in payload["errors"])
        if token and "Authentication required" in msgs:
            headers["Authorization"] = f"Bearer {token}"
            res = requests.post(
                GQL,
                headers=headers,
                json={"query": query, "variables": variables or {}},
                timeout=120,
            )
            res.raise_for_status()
            payload = res.json()
            if payload.get("errors"):
                msgs2 = "; ".join(e.get("message", str(e)) for e in payload["errors"])
                raise RuntimeError(msgs2)
            return payload["data"]
        raise RuntimeError(msgs)
    return payload["data"]


def login_magic(magic_token: str) -> str:
    data = gql(
        """
        mutation LoginWithMagicToken($input: LoginWithMagicTokenInput!) {
          loginWithMagicToken(input: $input) {
            success
            message
            token
            email
          }
        }
        """,
        {"input": {"token": magic_token}},
    )
    result = data["loginWithMagicToken"]
    if not result.get("success") or not result.get("token"):
        raise RuntimeError(result.get("message") or "magic login failed")
    TOKEN_PATH.write_text(result["token"])
    print(f"signed in as {result.get('email')}")
    return result["token"]


def request_magic_link(email: str) -> None:
    data = gql(
        """
        mutation RequestMagicLink($input: RequestMagicLinkInput!) {
          requestMagicLink(input: $input) {
            success
            message
          }
        }
        """,
        {"input": {"email": email, "redirect": "/account-map"}},
    )
    r = data["requestMagicLink"]
    print(f"magic link request success={r.get('success')} message={r.get('message')}")


def resolve_token() -> str:
    env_magic = os.environ.get("SPARK_MAGIC_TOKEN", "").strip()
    if env_magic:
        # Fresh magic-link token from email, or already a session JWT.
        if env_magic.startswith("eyJ") and env_magic.count(".") == 2:
            return env_magic
        return login_magic(env_magic)
    existing = TOKEN_PATH.read_text().strip() if TOKEN_PATH.exists() else ""
    if existing:
        try:
            gql(
                "query Me { me { id email } }",
                token=existing,
            )
            print("reusing existing session token")
            return existing
        except Exception as exc:  # noqa: BLE001
            print(f"existing token unusable ({exc}); need a magic link")
    raise RuntimeError("NO_TOKEN")


def find_torch(token: str) -> tuple[str, str, str]:
    data = gql(
        """
        query Tenants($filters: TenantFiltersInput, $first: Int) {
          tenants(filters: $filters, first: $first) {
            edges { node { id uuid name requestUrlName } }
          }
        }
        """,
        {"filters": {"name": "Torch"}, "first": 20},
        token,
    )
    edges = data["tenants"]["edges"]
    matches = []
    for e in edges:
        n = e["node"]
        blob = f"{n['name']} {n.get('requestUrlName') or ''}".lower()
        if "torch" in blob:
            matches.append(n)
    if not matches:
        raise RuntimeError("Torch tenant not found")
    t = next((n for n in matches if n.get("requestUrlName") == "keee-torch-thc"), matches[0])
    print(f"tenant {t['name']!r} id={t['id']} slug={t.get('requestUrlName')}")
    return t["id"], t["uuid"], t["name"]


def sheet_map(wb, name: str) -> list[dict]:
    if name not in wb.sheetnames:
        return []
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h or "").strip() for h in rows[0]]
    out = []
    for row in rows[1:]:
        out.append({headers[i]: row[i] if i < len(row) else None for i in range(len(headers))})
    return out


def pick_id(rows: list[dict], want: str) -> int:
    want_l = want.lower()
    for r in rows:
        name = str(r.get("name") or "").strip()
        if name.lower() == want_l:
            return int(r["id"])
    for r in rows:
        name = str(r.get("name") or "").strip()
        if want_l in name.lower():
            return int(r["id"])
    raise RuntimeError(f"no {want!r} in {[r.get('name') for r in rows]}")


def tz_codes(rows: list[dict]) -> set[str]:
    return {str(r.get("code") or "").strip().upper() for r in rows if r.get("code")}


def rebuild_xlsx(request_type_id: int, event_type_id: int, tz_available: set[str]) -> Path:
    spec = json.loads(JSON_PATH.read_text())
    rows = spec["rows"]

    def map_tz(code: str) -> str:
        c = code.upper()
        if c in tz_available:
            return c
        fallback = {"EDT": "EST", "CDT": "CST", "PDT": "PST", "MDT": "MST"}.get(c, c)
        if fallback in tz_available:
            return fallback
        return c

    wb = Workbook()
    ws = wb.active
    ws.title = "Requests"
    ws.append(TEMPLATE_COLUMNS)
    for r in rows:
        cell = {c: r.get(c, "") for c in TEMPLATE_COLUMNS}
        cell["request_type_id"] = request_type_id
        cell["event_type_id"] = event_type_id
        cell["timezone_code"] = map_tz(str(r.get("timezone_code") or "CDT"))
        cell["city"] = ""
        cell["state"] = ""
        cell["scheduling_status"] = "already_scheduled"
        ws.append([cell.get(c, "") if cell.get(c) is not None else "" for c in TEMPLATE_COLUMNS])
    READY_XLSX.parent.mkdir(parents=True, exist_ok=True)
    wb.save(READY_XLSX)
    print(f"ready xlsx {READY_XLSX} rows={len(rows)}")
    return READY_XLSX


def import_batch(token: str, tenant_id: str, blob_name: str, dry_run: bool) -> dict:
    data = gql(
        """
        mutation Import($input: ImportRequestsBatchInput!) {
          importRequestsBatch(input: $input) {
            success
            message
            totalRows
            successCount
            failedCount
            skippedCount
            rolledBack
            errors
            rows {
              rowNumber
              success
              message
              requestId
              requestUuid
              skipped
            }
          }
        }
        """,
        {
            "input": {
                "tenantId": tenant_id,
                "file": blob_name,
                "sheetName": "Requests",
                "dryRun": dry_run,
                "rollbackOnError": True,
            }
        },
        token,
    )
    return data["importRequestsBatch"]


def summarize(label: str, result: dict) -> None:
    print(f"\n{label}")
    print(f"  success={result.get('success')} rolledBack={result.get('rolledBack')}")
    print(
        f"  total={result.get('totalRows')} created={result.get('successCount')} "
        f"skipped={result.get('skippedCount')} failed={result.get('failedCount')}"
    )
    print(f"  message={result.get('message')}")
    errors = result.get("errors") or []
    if errors:
        print("  errors:")
        for e in errors[:25]:
            print(f"   - {e}")
        if len(errors) > 25:
            print(f"   …and {len(errors)-25} more")
    bad = [r for r in (result.get("rows") or []) if not r.get("success") and not r.get("skipped")]
    if bad and not errors:
        for r in bad[:15]:
            print(f"   row {r['rowNumber']}: {r.get('message')}")


def build_only() -> int:
    rows = parse_src_xlsx(SRC_XLSX)
    print(f"xlsx rows={len(rows)} unique_stores={len({r['store_number'] for r in rows})}")
    print(f"date range {rows[0]['date']} → {rows[-1]['date']}")
    stores = geocode_stores(rows)
    write_artifacts(rows, stores)
    miss = [s for s in stores if s.get("lat") is None]
    if miss:
        print(f"WARNING {len(miss)} stores missing geocode", file=sys.stderr)
    return 0


def upload_and_import(token: str, tenant_id: str, commit: bool) -> dict:
    raw = gql(
        """
        mutation BatchTemplate($input: RequestBatchTemplateInput!) {
          requestBatchTemplateDownloadUrl(input: $input) {
            success
            message
            fileBase64
            fileName
          }
        }
        """,
        {"input": {"tenantId": tenant_id}},
        token,
    )["requestBatchTemplateDownloadUrl"]
    if not raw.get("success") or not raw.get("fileBase64"):
        raise RuntimeError(raw.get("message") or "template download failed")
    import base64

    twb = load_workbook(BytesIO(base64.b64decode(raw["fileBase64"])), data_only=True)
    print("template sheets:", twb.sheetnames)
    request_types = sheet_map(twb, "RequestTypes")
    event_types = sheet_map(twb, "EventTypes")
    timezones = sheet_map(twb, "TimeZones")
    print("request types:", [(r.get("id"), r.get("name")) for r in request_types])
    print("event types:", [(r.get("id"), r.get("name")) for r in event_types])
    rt_id = pick_id(request_types, "Retail Sampling")
    et_id = pick_id(event_types, "Retail Sampling")
    print(f"using request_type_id={rt_id} event_type_id={et_id}")
    ready = rebuild_xlsx(rt_id, et_id, tz_codes(timezones))

    stamp = int(time.time() * 1000)
    file_path = f"requests/batch-uploads/tenant-{tenant_id}/{stamp}_torch_binnys_retail_schedule.xlsx"
    up = gql(
        """
        query GetUploadUrl($filePath: String!, $contentType: String!) {
          getUploadUrl(filePath: $filePath, contentType: $contentType) {
            uploadUrl
            blobName
          }
        }
        """,
        {
            "filePath": file_path,
            "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        token,
    )["getUploadUrl"]
    blob = up["blobName"]
    put = requests.put(
        up["uploadUrl"],
        headers={"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
        data=ready.read_bytes(),
        timeout=120,
    )
    if not put.ok:
        raise RuntimeError(f"GCS PUT failed {put.status_code} {put.text[:300]}")
    print(f"uploaded blob {blob}")

    dry = import_batch(token, tenant_id, blob, dry_run=True)
    summarize("DRY-RUN", dry)
    (OUT_DIR / "torch_binnys_dryrun.json").write_text(json.dumps(dry, indent=2))
    if not commit:
        return dry
    if (dry.get("failedCount") or 0) > 0:
        print("Refusing to commit because dry-run has failures.")
        return dry
    real = import_batch(token, tenant_id, blob, dry_run=False)
    summarize("COMMIT", real)
    (OUT_DIR / "torch_binnys_commit.json").write_text(json.dumps(real, indent=2))
    return real


def rebuild_from_template() -> int:
    tpl = OUT_DIR / "torch_binnys_template.xlsx"
    if not tpl.exists():
        raise RuntimeError(f"missing template {tpl}")
    if not JSON_PATH.exists():
        build_only()
    twb = load_workbook(tpl, data_only=True)
    print("template sheets:", twb.sheetnames)
    request_types = sheet_map(twb, "RequestTypes")
    event_types = sheet_map(twb, "EventTypes")
    timezones = sheet_map(twb, "TimeZones")
    print("request types:", [(r.get("id"), r.get("name")) for r in request_types])
    print("event types:", [(r.get("id"), r.get("name")) for r in event_types])
    print("timezone codes:", sorted(tz_codes(timezones)))
    rt_id = pick_id(request_types, "Retail Sampling")
    et_id = pick_id(event_types, "Retail Sampling")
    print(f"using request_type_id={rt_id} event_type_id={et_id}")
    rebuild_xlsx(rt_id, et_id, tz_codes(timezones))
    return 0


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "build"
    if mode == "build":
        return build_only()
    if mode == "rebuild-from-template":
        return rebuild_from_template()
    if mode == "request-magic":
        email = os.environ.get("SPARK_EMAIL", "kyle@igniteproductions.co")
        request_magic_link(email)
        return 0
    if mode == "import":
        if not JSON_PATH.exists():
            build_only()
        token = resolve_token()
        tenant_id, _, _ = find_torch(token)
        commit = os.environ.get("COMMIT", "0") == "1"
        upload_and_import(token, tenant_id, commit=commit)
        return 0
    raise SystemExit(f"unknown mode {mode}")


if __name__ == "__main__":
    raise SystemExit(main())
