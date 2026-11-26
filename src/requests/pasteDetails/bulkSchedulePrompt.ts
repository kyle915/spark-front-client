import { resolveTimezoneIdByDate } from "@/utils";

export interface BulkTimezoneOption {
  id: string;
  code?: string | null;
  name?: string | null;
  offset?: number | null;
}

export interface BulkScheduleRow {
  rowKey: string;
  storeKey: string;
  storeName: string;
  storeNumber: string;
  address: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  date: string;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  notes: string;
}

const EASTERN_STATES = new Set([
  "CT", "DC", "DE", "FL", "GA", "IN", "KY", "MA", "MD", "ME", "MI",
  "NC", "NH", "NJ", "NY", "OH", "PA", "RI", "SC", "VA", "VT", "WV",
]);
const CENTRAL_STATES = new Set([
  "AL", "AR", "IA", "IL", "KS", "LA", "MN", "MO", "MS", "ND", "NE",
  "OK", "SD", "TN", "TX", "WI",
]);
const MOUNTAIN_STATES = new Set(["CO", "ID", "MT", "NM", "UT", "WY"]);
const PACIFIC_STATES = new Set(["CA", "NV", "OR", "WA"]);

function stateRegionKeyword(stateCode: string): string | null {
  const s = stateCode.trim().toUpperCase();
  if (s === "AZ") return "arizona";
  if (s === "HI") return "hawaii";
  if (s === "AK") return "alaska";
  if (EASTERN_STATES.has(s)) return "eastern";
  if (CENTRAL_STATES.has(s)) return "central";
  if (MOUNTAIN_STATES.has(s)) return "mountain";
  if (PACIFIC_STATES.has(s)) return "pacific";
  return null;
}

export function resolveBulkRowTimezone(
  stateCode: string,
  isoDate: string,
  timezones: ReadonlyArray<BulkTimezoneOption>,
  fallbackTimezoneId?: string | null,
): { timezoneId: string | null; timezoneCode: string } {
  const kw = stateRegionKeyword(stateCode);
  let seed: BulkTimezoneOption | undefined;
  if (kw) {
    seed = timezones.find((tz) => (tz.name ?? "").toLowerCase().includes(kw));
  }
  if (!seed && fallbackTimezoneId) {
    seed = timezones.find((tz) => String(tz.id) === String(fallbackTimezoneId));
  }
  if (!seed) {
    return { timezoneId: null, timezoneCode: "Local TZ" };
  }
  const normalizedTzs = timezones.map((tz) => ({
    id: String(tz.id),
    code: tz.code ?? "",
    name: tz.name ?? "",
    offset: typeof tz.offset === "number" ? tz.offset : 0,
  }));
  const resolvedId = resolveTimezoneIdByDate(normalizedTzs, isoDate, String(seed.id));
  const picked =
    timezones.find((tz) => String(tz.id) === String(resolvedId)) ?? seed;
  return {
    timezoneId: String(picked.id),
    timezoneCode: picked.code || picked.name || "Local TZ",
  };
}

export function matchPromptProductIds(
  promptProducts: ReadonlyArray<{ uuid: string; name: string }>,
  catalog: ReadonlyArray<{ id: string; uuid?: string | null; name?: string | null }>,
): string[] {
  const byUuid = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const item of catalog) {
    if (item.uuid) byUuid.set(String(item.uuid), String(item.id));
    if (item.name) byName.set(item.name.trim().toLowerCase(), String(item.id));
  }
  const ids: string[] = [];
  for (const p of promptProducts) {
    const id =
      byUuid.get(String(p.uuid)) ?? byName.get(p.name.trim().toLowerCase());
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
