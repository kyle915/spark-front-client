/**
 * Spark v2 — reading an uploaded account file (CSV/XLSX) for the Account Map.
 *
 * The list itself is saved on the server, per brand (`saveAccountList`).
 * Before that it lived only in the uploading browser's localStorage;
 * `loadUploadedAccounts` still reads that old copy so it can be sent to the
 * server once (see useAccountList.ts). Nothing writes to it any more, and
 * nothing removes it.
 */

export type UploadedAccount = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  chain: string;
  status: "unvisited" | "scheduled" | "recent";
  notes?: string;
  lat?: number;
  lng?: number;
};

const KEY = (tenantId: string) => `@spark.uploadedAccounts/${tenantId}`;

export const loadUploadedAccounts = (tenantId: string): UploadedAccount[] => {
  try {
    const raw = localStorage.getItem(KEY(tenantId));
    return raw ? (JSON.parse(raw) as UploadedAccount[]) : [];
  } catch {
    return [];
  }
};

/**
 * Best-effort column mapping. Accepts variations like "Account Name",
 * "Store Name", "Retailer", "Location", "Address 1" etc.
 */
const FIELD_ALIASES: Record<keyof UploadedAccount, string[]> = {
  id: [],
  name: ["name", "account", "account name", "store", "store name", "retailer", "venue", "location"],
  address: ["address", "street", "address 1", "address1", "addr"],
  city: ["city", "town"],
  state: ["state", "st", "region"],
  zip: ["zip", "zipcode", "postal", "postal code"],
  chain: ["chain", "banner", "brand", "parent"],
  status: ["status"],
  notes: ["notes", "comment", "comments"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude"],
};

const normHeader = (h: string) => h.trim().toLowerCase();

const buildHeaderMap = (
  headers: string[],
): Partial<Record<keyof UploadedAccount, string>> => {
  const out: Partial<Record<keyof UploadedAccount, string>> = {};
  const lowered = headers.map(normHeader);
  for (const [key, aliases] of Object.entries(FIELD_ALIASES) as Array<
    [keyof UploadedAccount, string[]]
  >) {
    for (const a of aliases) {
      const idx = lowered.indexOf(a);
      if (idx !== -1) {
        out[key] = headers[idx];
        break;
      }
    }
  }
  return out;
};

export const parseRowsToAccounts = (
  rows: Record<string, string | number>[],
  headers: string[],
): UploadedAccount[] => {
  const map = buildHeaderMap(headers);
  const out: UploadedAccount[] = [];
  rows.forEach((row, i) => {
    const v = (key: keyof UploadedAccount): string => {
      const col = map[key];
      if (!col) return "";
      const raw = row[col];
      return raw === undefined || raw === null ? "" : String(raw).trim();
    };
    const name = v("name");
    if (!name) return;
    const acc: UploadedAccount = {
      id: `acc_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      address: v("address"),
      city: v("city"),
      state: v("state"),
      zip: v("zip"),
      chain: v("chain"),
      status:
        (v("status") as UploadedAccount["status"]) || "unvisited",
    };
    const notes = v("notes");
    if (notes) acc.notes = notes;
    const lat = parseFloat(v("lat"));
    if (!Number.isNaN(lat) && lat !== 0) acc.lat = lat;
    const lng = parseFloat(v("lng"));
    if (!Number.isNaN(lng) && lng !== 0) acc.lng = lng;
    out.push(acc);
  });
  return out;
};
