/**
 * Everything the Account Map derives, kept free of React and of Relay's
 * generated files so it can be unit-tested before `relay-compiler` runs.
 *
 * One STORE is one physical place. The server tells us which request rows are
 * the same store (`storeKey`: same street address or same spot on the ground)
 * and gives each store its own visit count. A brand's uploaded account list
 * adds stores that have no request yet; a list row that is already a store
 * on the map does not become a second pin.
 */
import {
  coverageFromVisitCount,
  parseCoverageClass,
  type CoverageClass,
} from "@/shared/map/accountCoverage";
import { isPlottable, type LatLng } from "@/shared/map/mapFit";

/** One `accountMapPins` row (a request), as the query returns it. */
export type PinRow = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  date: string | null | undefined;
  retailerName: string;
  locationName: string;
  stateCode: string;
  coverageClass: string;
  visitCount: number;
  planned: boolean;
  storeKey: string;
  /** The store's newest filed visit (ISO); absent from older servers. */
  lastVisitDate?: string | null;
};

/** One row of the brand's uploaded account list, as saved on the server. */
export type ListEntry = {
  uuid: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  chain: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** "pending" | "ok" | "provided" | "not_found" | "no_address" */
  positionStatus: string;
};

export type Store = {
  key: string;
  name: string;
  /** "Chino, CA" — city and state, or "" when neither is known. */
  market: string;
  /** Two-letter code, "" when unknown. */
  state: string;
  address: string;
  coverage: CoverageClass;
  visitCount: number;
  planned: boolean;
  /** Null for an uploaded store whose address has not been placed. */
  position: LatLng | null;
  /** Date of the newest request at this store; null for list-only stores. */
  lastRequestDate: string | null;
  /** Date of the newest filed visit (a demo with a recap); null when never. */
  lastVisitDate: string | null;
  /** City, "" when unknown. With `state` it makes the market. */
  city: string;
  /** True when no store name was known and `name` is the street: such a
   *  store is listed, but is not a retailer in the menu. */
  unnamed?: boolean;
  /** "requests": has at least one request. "list": only on the uploaded list. */
  source: "requests" | "list";
  /** True when the store is on the brand's uploaded account list. */
  onList: boolean;
  /** Only for list-only stores without a position: why there is none. */
  positionStatus: string | null;
};

/** Same folding as the server's `normalise_address`: case, punctuation and
 *  spacing do not make two addresses different. */
export function normaliseAddress(text: string | null | undefined): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#_]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** City + ST from a US one-line address when the row has no location. */
export function marketFromAddress(address: string | null | undefined): {
  city: string;
  state: string;
} {
  const raw = String(address || "").trim();
  const m = raw.match(/^(.*?),\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\s*$/);
  if (!m) return { city: "", state: "" };
  const state = m[2].toUpperCase();
  const head = m[1].trim();
  const commaCity = head.match(/^(.*),\s*([^,]+)$/);
  if (commaCity) return { city: commaCity[2].trim(), state };
  const afterStreet = head.match(
    /^(?:.*?\b(?:Rd\.|Ave\.|St\.|Hwy\.|Dr\.|Blvd\.|Pkwy\.?|Ln\.|Ct\.|Pl\.|Trail))\s+(.+)$/i,
  );
  if (afterStreet) return { city: afterStreet[1].trim(), state };
  const words = head.split(/\s+/);
  return { city: words.slice(-2).join(" "), state };
}

/** Street, city, "ST 12345" on one line, skipping the empty parts. */
export function listEntryAddress(e: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const tail = [e.state.trim(), e.zip.trim()].filter(Boolean).join(" ");
  return [e.address.trim(), e.city.trim(), tail].filter(Boolean).join(", ");
}

const stateCode = (raw: string): string => {
  const s = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : "";
};

/** Metres between two points; fine for "is this the same building". */
export function metresBetween(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (a.lat - b.lat) * rad;
  const dLng = (a.lng - b.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  return Math.sqrt(dLat * dLat + dLng * dLng) * 6_371_000;
}

/** A list row this close to a store on the map is that store. */
export const SAME_STORE_METRES = 75;

// ~110 m cells: a list row is compared with stores in its cell and the
// eight around it, never with every store.
const cellOf = (p: LatLng): [number, number] => [
  Math.round(p.lat * 1000),
  Math.round(p.lng * 1000),
];

const MONTH = "(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\\.?";
const DATE_PATTERNS = [
  // 2027-01-11, 2027/1/11
  "\\b\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}\\b",
  // 05/16/2026, 5/16/26, 5/16 (a slash is a date; "7-11" is a store)
  "\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b",
  // 05-16-2026, 5.16.26 (dash / dot only with all three parts)
  "\\b\\d{1,2}[-.]\\d{1,2}[-.]\\d{2,4}\\b",
  // May 17, Jan 9th 2027, Sept. 3, 2026
  `\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?\\b`,
  // 10am-2pm, 10:00 AM - 2:00 PM, 3pm
  "\\b\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?\\s*[-\u2013\u2014]\\s*\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b",
  "\\b\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b",
];
// "Sat 11/12", "Saturday, May 17": the weekday goes with its date.
const WEEKDAY = "(?:\\b(?:mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\\b\\.?,?\\s+)?";
const DATES = new RegExp(`${WEEKDAY}(?:${DATE_PATTERNS.map((p) => `(?:${p})`).join("|")})`, "gi");
const DATE_ONLY = new RegExp(`^(?:${WEEKDAY}(?:${DATE_PATTERNS.join("|")})[\\s,]*)+$`, "i");
const EDGE = /^[\s\u00b7\u2022|,;:\-\u2013\u2014/]+|[\s\u00b7\u2022|,;:\-\u2013\u2014/(]+$/g;
const EMPTY_PARENS = /\(\s*\)|\[\s*\]/g;
const SEP_RUN = /\s*([\u00b7\u2022|])\s*(?:[\u00b7\u2022|\-\u2013\u2014]\s*)+/g;

/**
 * A store name without the visit's date. Requests are usually named
 * "<store> · <date>" and most have no linked retailer, so the request name
 * stood in for the store and the retailer menu listed one entry per visit.
 * Same rules as the server's `events/store_labels.py`; keep them in step.
 * Returns the trimmed original when nothing would be left.
 */
export function cleanStoreLabel(text: string | null | undefined): string {
  const raw = String(text ?? "").split(/\s+/).filter(Boolean).join(" ");
  if (!raw) return "";
  let out = raw
    .replace(DATES, " ")
    .replace(EMPTY_PARENS, " ")
    .replace(SEP_RUN, " $1 ")
    .replace(/\s+/g, " ");
  let previous = "";
  while (previous !== out) {
    previous = out;
    out = out.replace(EDGE, "").trim();
  }
  return out || raw;
}

/** True for a label that is nothing but a date ("05/17/2026"). */
export function isDateOnlyLabel(text: string | null | undefined): boolean {
  const raw = String(text ?? "").split(/\s+/).filter(Boolean).join(" ");
  return raw !== "" && DATE_ONLY.test(raw);
}

/** The name a pin row's store goes by: its retailer, else its request name,
 *  else its street — never a date. */
export function storeLabel(row: {
  retailerName?: string | null;
  name?: string | null;
  address?: string | null;
}): string {
  return storeName(row).name;
}

/** `storeLabel`, and whether the name is only the street (no store name to
 *  go on, so it is no retailer). */
function storeName(row: {
  retailerName?: string | null;
  name?: string | null;
  address?: string | null;
}): { name: string; fromStreet: boolean } {
  for (const candidate of [row.retailerName, row.name]) {
    const label = cleanStoreLabel(candidate);
    if (label && !isDateOnlyLabel(label)) return { name: label, fromStreet: false };
  }
  const street = String(row.address ?? "").split(",")[0].trim();
  return { name: street || "Unnamed store", fromStreet: true };
}

function fallbackKey(row: PinRow): string {
  return `${row.retailerName || row.name}|${row.lat.toFixed(5)}|${row.lng.toFixed(5)}`;
}

/**
 * Request rows + the uploaded list → one entry per physical store.
 *
 * `pins` arrive newest first, so the first row of a store names it and
 * places it. The visit count, coverage and "planned" are the store's own
 * (the server sends the same values on each of its rows).
 */
export function buildStores(
  pins: ReadonlyArray<PinRow>,
  list: ReadonlyArray<ListEntry> = [],
): Store[] {
  const byKey = new Map<string, Store>();
  for (const row of pins) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!isPlottable(lat, lng)) continue;
    const key = row.storeKey || fallbackKey(row);
    const visitCount = Math.max(0, Number(row.visitCount ?? 0) || 0);
    const lastVisit = row.lastVisitDate ?? null;
    const existing = byKey.get(key);
    if (existing) {
      if (lastVisit && (!existing.lastVisitDate || lastVisit > existing.lastVisitDate)) {
        existing.lastVisitDate = lastVisit;
      }
      existing.visitCount = Math.max(existing.visitCount, visitCount);
      existing.coverage = coverageFromVisitCount(existing.visitCount);
      existing.planned = existing.planned || Boolean(row.planned);
      if (row.date && (!existing.lastRequestDate || row.date > existing.lastRequestDate)) {
        existing.lastRequestDate = row.date;
      }
      continue;
    }
    const parsed = marketFromAddress(row.address);
    const state = stateCode(row.stateCode || parsed.state);
    const city = row.locationName || parsed.city;
    const label = storeName(row);
    byKey.set(key, {
      key,
      name: label.name,
      unnamed: label.fromStreet,
      market: [city, state].filter(Boolean).join(", "),
      city: city.trim(),
      state,
      address: row.address ?? "",
      // Trust the visit count over the label if the two ever disagree.
      coverage:
        visitCount > 0
          ? coverageFromVisitCount(visitCount)
          : parseCoverageClass(row.coverageClass),
      visitCount,
      planned: Boolean(row.planned),
      position: { lat, lng },
      lastRequestDate: row.date ?? null,
      lastVisitDate: lastVisit,
      source: "requests",
      onList: false,
      positionStatus: null,
    });
  }

  const stores = Array.from(byKey.values());
  const byAddress = new Map<string, Store>();
  const byCell = new Map<string, Store[]>();
  for (const s of stores) {
    const a = normaliseAddress(s.address);
    if (a && !byAddress.has(a)) byAddress.set(a, s);
    if (s.position) {
      const [cy, cx] = cellOf(s.position);
      const k = `${cy}|${cx}`;
      const held = byCell.get(k);
      if (held) held.push(s);
      else byCell.set(k, [s]);
    }
  }
  const storeNear = (p: LatLng): Store | null => {
    const [cy, cx] = cellOf(p);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (const s of byCell.get(`${cy + dy}|${cx + dx}`) ?? []) {
          if (s.position && metresBetween(s.position, p) <= SAME_STORE_METRES) return s;
        }
      }
    }
    return null;
  };

  const listOnly: Store[] = [];
  for (const e of list) {
    const name = e.name.trim();
    if (!name) continue;
    const address = listEntryAddress(e);
    const lat = Number(e.lat);
    const lng = Number(e.lng);
    const position =
      e.lat != null && e.lng != null && isPlottable(lat, lng) ? { lat, lng } : null;
    const known =
      (address ? byAddress.get(normaliseAddress(address)) : undefined) ??
      (position ? storeNear(position) : null);
    if (known) {
      known.onList = true;
      continue;
    }
    const state = stateCode(e.state);
    listOnly.push({
      key: `list:${e.uuid}`,
      name,
      market: [e.city.trim(), state || e.state.trim()].filter(Boolean).join(", "),
      city: e.city.trim(),
      state,
      address,
      coverage: "never_visited",
      visitCount: 0,
      planned: false,
      position,
      lastRequestDate: null,
      lastVisitDate: null,
      source: "list",
      onList: true,
      positionStatus: position ? null : e.positionStatus,
    });
  }
  listOnly.sort((a, b) => a.name.localeCompare(b.name));
  return [...stores, ...listOnly];
}

export type CoverageFilter = "all" | CoverageClass | "planned";

export type StoreFilters = {
  /** Free text: store name, city or address. */
  q: string;
  coverage: CoverageFilter;
  /** Two-letter state code, or "all". */
  state: string;
  /** Chain key (casing and light punctuation folded), a raw banner name, or "all". */
  retailer: string;
  /** Market key from `marketKey` ("tempe|AZ"), or "all". Optional for callers
   *  written before markets. */
  market?: string;
};

export const NO_FILTERS: StoreFilters = {
  q: "",
  coverage: "all",
  state: "all",
  retailer: "all",
  market: "all",
};

/** Search folding: like an address, and an apostrophe joins rather than
 *  splits, so "frys" and "fry's" both find "Fry's". */
const searchFold = (text: string): string =>
  normaliseAddress(text.replace(/['\u2018\u2019]/g, ""));

/** Every word typed must appear somewhere in the name, city or address. */
export function matchesSearch(store: Store, q: string): boolean {
  const words = searchFold(q).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const hay = searchFold(`${store.name} ${store.market} ${store.address}`);
  return words.every((w) => hay.includes(w));
}

export function filterStores(
  stores: ReadonlyArray<Store>,
  f: StoreFilters,
): Store[] {
  return stores.filter((s) => {
    if (f.coverage === "planned" ? !s.planned : f.coverage !== "all" && s.coverage !== f.coverage) {
      return false;
    }
    if (f.state !== "all" && s.state !== f.state) return false;
    if (f.market && f.market !== "all" && marketKey(s) !== f.market) return false;
    if (
      f.retailer !== "all" &&
      retailerChainKey(s.name) !== retailerChainKey(f.retailer)
    ) {
      return false;
    }
    return matchesSearch(s, f.q);
  });
}

export const hasFilters = (f: StoreFilters): boolean =>
  f.q.trim() !== "" ||
  f.coverage !== "all" ||
  f.state !== "all" ||
  f.retailer !== "all" ||
  (f.market ?? "all") !== "all";

/** One market per city + state; casing does not make two. "" when no city. */
export function marketKey(store: { city: string; state: string }): string {
  const city = store.city.trim().toLowerCase().replace(/\s+/g, " ");
  return city ? `${city}|${store.state}` : "";
}

/** Markets (city, ST) with their store counts, biggest first. Pass a state
 *  to list only that state's markets. */
export function marketOptions(
  stores: ReadonlyArray<Store>,
  state: string = "all",
): Array<{ key: string; name: string; count: number }> {
  const markets = new Map<string, { name: string; count: number }>();
  for (const s of stores) {
    if (state !== "all" && s.state !== state) continue;
    const key = marketKey(s);
    if (!key) continue;
    const held = markets.get(key);
    if (held) held.count += 1;
    else markets.set(key, { name: [s.city.trim(), s.state].filter(Boolean).join(", "), count: 1 });
  }
  return Array.from(markets.entries())
    .map(([key, m]) => ({ key, ...m }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type StoreCounts = {
  all: number;
  sampled: number;
  repeat: number;
  neverVisited: number;
  planned: number;
  /** Stores with a position, i.e. pins. */
  onMap: number;
};

export function storeCounts(stores: ReadonlyArray<Store>): StoreCounts {
  const c: StoreCounts = {
    all: stores.length,
    sampled: 0,
    repeat: 0,
    neverVisited: 0,
    planned: 0,
    onMap: 0,
  };
  for (const s of stores) {
    if (s.coverage === "sampled") c.sampled += 1;
    else if (s.coverage === "repeat") c.repeat += 1;
    else c.neverVisited += 1;
    if (s.planned) c.planned += 1;
    if (s.position) c.onMap += 1;
  }
  return c;
}

/**
 * Fold a banner so Kroger and KROGER, and 7-Eleven and 7 ELEVEN, are one chain.
 * Store numbers stay, so Kroger 123 and Kroger 456 do not merge.
 */
export function retailerChainKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['\u2018\u2019.]/g, "")
    .replace(/[-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A date is not a retailer. The menu count is added by the UI, not the name. */
export function isDateRetailerName(name: string): boolean {
  const trimmed = name.trim();
  return /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/.test(trimmed);
}

function retailerDisplayName(spellings: ReadonlyArray<[string, number]>): string {
  const ranked = [...spellings].sort((a, b) => {
    const mixed = (name: string) => /[a-z]/.test(name) && /[A-Z]/.test(name);
    const aMixed = mixed(a[0]);
    const bMixed = mixed(b[0]);
    if (aMixed !== bMixed) return aMixed ? -1 : 1;
    const aLower = /[a-z]/.test(a[0]);
    const bLower = /[a-z]/.test(b[0]);
    if (aLower !== bLower) return aLower ? -1 : 1;
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return ranked[0]?.[0] ?? "";
}

/** Chains with how many stores carry each, biggest banner first. Dates are omitted. */
export function retailerOptions(
  stores: ReadonlyArray<Store>,
): Array<{ key: string; name: string; count: number }> {
  const chains = new Map<string, { spellings: Map<string, number>; total: number }>();
  for (const s of stores) {
    if (s.unnamed) continue;
    const name = cleanStoreLabel(s.name);
    if (!name || isDateRetailerName(name) || isDateOnlyLabel(name)) continue;
    const key = retailerChainKey(name);
    if (!key) continue;
    let chain = chains.get(key);
    if (!chain) {
      chain = { spellings: new Map(), total: 0 };
      chains.set(key, chain);
    }
    chain.spellings.set(name, (chain.spellings.get(name) ?? 0) + 1);
    chain.total += 1;
  }
  return Array.from(chains.entries())
    .map(([key, chain]) => ({
      key,
      name: retailerDisplayName(Array.from(chain.spellings.entries())),
      count: chain.total,
    }))
    .filter((row) => row.name.length > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function stateOptions(stores: ReadonlyArray<Store>): string[] {
  return Array.from(new Set(stores.map((s) => s.state).filter(Boolean))).sort();
}

/**
 * Identity of "the set of pins". The camera re-fits only when this changes.
 * Counting is enough: within one scope (brand + filters) the set only grows,
 * when more rows load or more list stores get a position.
 */
export function storesFitKey(scope: string, stores: ReadonlyArray<Store>): string {
  let onMap = 0;
  for (const s of stores) if (s.position) onMap += 1;
  return `${scope}|${onMap}`;
}

export type ListSummary = {
  total: number;
  /** Rows with a position (from the file, or looked up). */
  placed: number;
  /** Rows with an address still waiting to be looked up. */
  pending: number;
  /** Rows whose address has no street-level spot, or that have no address. */
  unplaceable: number;
};

export function listSummary(list: ReadonlyArray<ListEntry>): ListSummary {
  const out: ListSummary = { total: list.length, placed: 0, pending: 0, unplaceable: 0 };
  for (const e of list) {
    if (e.positionStatus === "ok" || e.positionStatus === "provided") out.placed += 1;
    else if (e.positionStatus === "pending") out.pending += 1;
    else out.unplaceable += 1;
  }
  return out;
}

/** Why a list-only store has no pin, in words. */
export function noPositionWords(status: string | null): string {
  switch (status) {
    case "pending":
      return "Address not looked up yet";
    case "not_found":
      return "Address not found";
    case "no_address":
      return "No street address";
    default:
      return "No map position";
  }
}

/** One row of the uploaded file, as `saveAccountList` takes it. */
export type ListInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  chain: string;
  notes: string;
  lat: number | null;
  lng: number | null;
};

export function toListInput(row: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  chain?: string;
  notes?: string;
  lat?: number;
  lng?: number;
}): ListInput {
  const text = (v: string | undefined) => String(v ?? "").trim();
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const placed = row.lat != null && row.lng != null && isPlottable(lat, lng);
  return {
    name: text(row.name),
    address: text(row.address),
    city: text(row.city),
    state: text(row.state),
    zip: text(row.zip),
    chain: text(row.chain),
    notes: text(row.notes),
    lat: placed ? lat : null,
    lng: placed ? lng : null,
  };
}

export function chunk<T>(rows: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += Math.max(1, size)) {
    out.push(rows.slice(i, i + Math.max(1, size)));
  }
  return out;
}

/** "1 store" / "12 stores". */
export const storesWord = (n: number): string =>
  `${n.toLocaleString("en-US")} ${n === 1 ? "store" : "stores"}`;
