#!/usr/bin/env python3
"""Import Retail Schedule Y-rows into Torch Master Tracker via GraphQL."""

from __future__ import annotations

import json
import os
import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from openpyxl import Workbook, load_workbook

GQL = "https://spark-api-new-490085168610.us-central1.run.app/api/v483927/graphql/spark"
XLSX = Path("/Users/kylechristiansen/spark-front-client/output/torch_twm_retail_schedule.xlsx")
JSON_PATH = Path("/Users/kylechristiansen/spark-front-client/output/torch_twm_retail_schedule.json")
TOKEN_PATH = Path("/tmp/spark-jwt.txt")

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


def _token_meta(token: str) -> str:
    return (
        f"len={len(token)} dots={token.count('.')} colons={token.count(':')} "
        f"jwtish={token.startswith('eyJ') and token.count('.') == 2}"
    )


def gql(query: str, variables: dict | None = None, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        # gqlauth JWT middleware wants a real PyJWT. Frontend uses "JWT ";
        # tests use "Bearer ". Try JWT first, then Bearer on auth failures.
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
                raise RuntimeError(
                    f"{msgs2} (token {_token_meta(token)}; JWT then Bearer failed)"
                )
            return payload["data"]
        raise RuntimeError(msgs)
    return payload["data"]


def login(magic_token: str) -> str:
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


def find_torch(token: str) -> tuple[str, str, str]:
    data = gql(
        """
        query Tenants($filters: TenantFiltersInput, $first: Int) {
          tenants(filters: $filters, first: $first) {
            edges { node { id uuid name requestUrlName } }
            totalCount
          }
        }
        """,
        {"filters": {"name": "Torch"}, "first": 20},
        token,
    )
    edges = data["tenants"]["edges"]
    if not edges:
        data = gql(
            """
            query Tenants($first: Int) {
              tenants(first: $first) {
                edges { node { id uuid name requestUrlName } }
              }
            }
            """,
            {"first": 100},
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
        names = [e["node"]["name"] for e in edges[:30]]
        raise RuntimeError(f"Torch tenant not found. Sample: {names}")
    t = matches[0]
    print(f"tenant {t['name']!r} id={t['id']} slug={t.get('requestUrlName')}")
    return t["id"], t["uuid"], t["name"]


def download_template(token: str, tenant_id: str) -> bytes:
    data = gql(
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
    )
    r = data["requestBatchTemplateDownloadUrl"]
    if not r.get("success") or not r.get("fileBase64"):
        raise RuntimeError(r.get("message") or "template download failed")
    import base64

    return base64.b64decode(r["fileBase64"])


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


def rebuild_xlsx(src: Path, request_type_id: int, event_type_id: int, tz_available: set[str]) -> Path:
    spec = json.loads(JSON_PATH.read_text())
    rows = spec["rows"]
    # Fall back EST/CST if DST codes aren't in the TimeZones table.
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
        cell["timezone_code"] = map_tz(str(r.get("timezone_code") or "EDT"))
        # city omitted on purpose — importer hard-fails unknown Location names
        cell["city"] = ""
        cell["state"] = ""
        ws.append([cell.get(c, "") for c in TEMPLATE_COLUMNS])
    out = Path("/Users/kylechristiansen/spark-front-client/output/torch_twm_retail_schedule.ready.xlsx")
    wb.save(out)
    print(f"ready xlsx {out} rows={len(rows)}")
    return out


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
    print(f"  total={result.get('totalRows')} created={result.get('successCount')} skipped={result.get('skippedCount')} failed={result.get('failedCount')}")
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


def main() -> int:
    magic = os.environ.get("SPARK_MAGIC_TOKEN", "").strip()
    if not magic:
        print("SPARK_MAGIC_TOKEN missing", file=sys.stderr)
        return 2
    commit = os.environ.get("COMMIT", "0") == "1"
    token = login(magic)
    tenant_id, tenant_uuid, tenant_name = find_torch(token)

    raw = download_template(token, tenant_id)
    twb = load_workbook(BytesIO(raw), data_only=True)
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

    ready = rebuild_xlsx(XLSX, rt_id, et_id, tz_codes(timezones))

    # upload
    stamp = int(time.time() * 1000)
    file_path = f"requests/batch-uploads/tenant-{tenant_id}/{stamp}_torch_twm_retail_schedule.xlsx"
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
    Path("/Users/kylechristiansen/spark-front-client/output/torch_twm_dryrun.json").write_text(
        json.dumps(dry, indent=2)
    )

    if not commit:
        print("\nStopping after dry-run. Re-run with COMMIT=1 to write.")
        return 0 if (dry.get("failedCount") or 0) == 0 else 1

    if (dry.get("failedCount") or 0) > 0:
        print("Refusing to commit because dry-run has failures.")
        return 1

    real = import_batch(token, tenant_id, blob, dry_run=False)
    summarize("COMMIT", real)
    Path("/Users/kylechristiansen/spark-front-client/output/torch_twm_commit.json").write_text(
        json.dumps(real, indent=2)
    )
    return 0 if real.get("success") or (real.get("successCount") or 0) > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
