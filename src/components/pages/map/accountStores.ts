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
    const existing = byKey.get(key);
    if (existing) {
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
    byKey.set(key, {
      key,
      name: row.retailerName || row.name || "Unnamed store",
      market: [city, state].filter(Boolean).join(", "),
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
      state,
      address,
      coverage: "never_visited",
      visitCount: 0,
      planned: false,
      position,
      lastRequestDate: null,
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
  /** Banner group key (case and hyphen folded), a raw name, or "all". */
  retailer: string;
};

export const NO_FILTERS: StoreFilters = {
  q: "",
  coverage: "all",
  state: "all",
  retailer: "all",
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
    if (
      f.retailer !== "all" &&
      retailerGroupKey(s.name) !== retailerGroupKey(f.retailer)
    ) {
      return false;
    }
    return matchesSearch(s, f.q);
  });
}

export const hasFilters = (f: StoreFilters): boolean =>
  f.q.trim() !== "" || f.coverage !== "all" || f.state !== "all" || f.retailer !== "all";

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

const DATE_RETAILER_RE =
  /^(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/;

/** A retailer menu entry that is only a calendar date, not a chain. */
export function isDateRetailerName(name: string): boolean {
  return DATE_RETAILER_RE.test(name.trim());
}

/**
 * Chains that differ only by case, hyphen, or spacing.
 * "Kroger" and "KROGER" share a key; "7-Eleven" and "7 ELEVEN" do too.
 */
export function retailerGroupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-–—_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function preferredRetailerLabel(counts: Map<string, number>): string {
  const entries = [...counts.entries()];
  const mixed = entries.filter(([name]) => /[a-z]/.test(name));
  const pool = mixed.length > 0 ? mixed : entries;
  pool.sort(
    (a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]),
  );
  return pool[0][0];
}

/** Store names with how many stores carry each, biggest banner first. */
export function retailerOptions(
  stores: ReadonlyArray<Store>,
): Array<{ name: string; count: number; key: string }> {
  const groups = new Map<string, { counts: Map<string, number>; total: number }>();
  for (const s of stores) {
    const raw = s.name.trim();
    if (!raw || isDateRetailerName(raw)) continue;
    const key = retailerGroupKey(raw);
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { counts: new Map(), total: 0 };
      groups.set(key, group);
    }
    group.counts.set(raw, (group.counts.get(raw) ?? 0) + 1);
    group.total += 1;
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      name: preferredRetailerLabel(group.counts),
      count: group.total,
    }))
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
