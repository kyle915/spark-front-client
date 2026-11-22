import { marketFromAddress } from "./accountStores";
import { resolveTimezoneIdByDate } from "@/utils";

export interface WaveTimezoneOption {
  id: string;
  code?: string | null;
  name?: string | null;
  offset?: number | null;
}

export interface WaveTargetStore {
  key: string;
  name: string;
  address: string;
  market?: string | null;
  state?: string | null;
  position?: { lat: number; lng: number } | null;
}

export type WaveDateMode = "window" | "single";
export type WaveWindowAssignMode = "spread" | "every";

export interface WavePreviewRow {
  rowKey: string;
  storeKey: string;
  storeName: string;
  address: string;
  city: string;
  stateCode: string;
  lat: number | null;
  lng: number | null;
  date: string;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  timezoneId: string | null;
  timezoneCode: string;
  missingAddress: boolean;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const WAVE_WEEKDAYS: ReadonlyArray<{ day: number; short: string; label: string }> = [
  { day: 0, short: "Sun", label: "Sunday" },
  { day: 1, short: "Mon", label: "Monday" },
  { day: 2, short: "Tue", label: "Tuesday" },
  { day: 3, short: "Wed", label: "Wednesday" },
  { day: 4, short: "Thu", label: "Thursday" },
  { day: 5, short: "Fri", label: "Friday" },
  { day: 6, short: "Sat", label: "Saturday" },
];

const EASTERN_STATES = new Set([
  "CT", "DC", "DE", "FL", "GA", "IN", "KY", "MA", "MD", "ME", "MI",
  "NC", "NH", "NJ", "NY", "OH", "PA", "RI", "SC", "VA", "VT", "WV",
]);

const CENTRAL_STATES = new Set([
  "AL", "AR", "IA", "IL", "KS", "LA", "MN", "MO", "MS", "ND", "NE",
  "OK", "SD", "TN", "TX", "WI",
]);

const MOUNTAIN_STATES = new Set([
  "CO", "ID", "MT", "NM", "UT", "WY",
]);

const PACIFIC_STATES = new Set([
  "CA", "NV", "OR", "WA",
]);

const MAX_WINDOW_DAYS = 185;

function parseIsoDateUtc(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

function formatIsoDateUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultWaveWindow(today: Date = new Date()): {
  singleDate: string;
  windowStart: string;
  windowEnd: string;
} {
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const start = new Date(base.getTime() + 3 * 86_400_000);
  const end = new Date(base.getTime() + 24 * 86_400_000);
  return {
    singleDate: formatIsoDateUtc(start),
    windowStart: formatIsoDateUtc(start),
    windowEnd: formatIsoDateUtc(end),
  };
}

/**
 * Enumerates YYYY-MM-DD dates in [startDate, endDate] matching `weekdays` (0=Sun..6=Sat).
 * If `weekdays` is empty, every calendar day in the window matches.
 */
export function matchingDatesInWindow(
  startDate: string,
  endDate: string,
  weekdays: ReadonlyArray<number>,
): string[] {
  const start = parseIsoDateUtc(startDate);
  const end = parseIsoDateUtc(endDate);
  if (!start || !end || end.getTime() < start.getTime()) return [];

  const allowed = weekdays.length > 0 ? new Set(weekdays) : null;
  const out: string[] = [];
  let cursor = start;
  let scanned = 0;

  while (cursor.getTime() <= end.getTime() && scanned < MAX_WINDOW_DAYS) {
    const dow = cursor.getUTCDay();
    if (!allowed || allowed.has(dow)) {
      out.push(formatIsoDateUtc(cursor));
    }
    cursor = new Date(cursor.getTime() + 86_400_000);
    scanned += 1;
  }
  return out;
}

export function extractCityState(store: WaveTargetStore): {
  city: string;
  stateCode: string;
} {
  const parsedFromAddr = marketFromAddress(store.address);
  let stateCode = (store.state ?? "").trim().toUpperCase();
  let city = "";

  const market = (store.market ?? "").trim();
  if (market) {
    const m = market.match(/^(.*?),\s*([A-Za-z]{2})$/);
    if (m) {
      city = m[1].trim();
      if (!stateCode) stateCode = m[2].toUpperCase();
    } else if (/^[A-Za-z]{2}$/.test(market)) {
      if (!stateCode) stateCode = market.toUpperCase();
    } else {
      city = market;
    }
  }

  if (!city && parsedFromAddr.city) city = parsedFromAddr.city;
  if (!stateCode && parsedFromAddr.state) stateCode = parsedFromAddr.state;
  if (!/^[A-Z]{2}$/.test(stateCode)) stateCode = "";

  return { city, stateCode };
}

type RegionGroup =
  | "eastern"
  | "central"
  | "mountain"
  | "arizona"
  | "pacific"
  | "alaska"
  | "hawaii";

export function inferRegionGroupForStore(store: WaveTargetStore): RegionGroup | null {
  const { stateCode } = extractCityState(store);
  const lat = store.position?.lat;
  const lng = store.position?.lng;
  const hasLat = typeof lat === "number" && Number.isFinite(lat);
  const hasLng = typeof lng === "number" && Number.isFinite(lng);

  if (stateCode === "AZ") return "arizona";
  if (stateCode === "HI") return "hawaii";
  if (stateCode === "AK") return "alaska";

  // Split-timezone US states: use coordinates when available before falling
  // back to the state's primary timezone.
  if (stateCode === "FL" && hasLng) {
    return lng < -85.0 ? "central" : "eastern";
  }
  if (stateCode === "TN" && hasLng) {
    return lng >= -85.6 ? "eastern" : "central";
  }
  if (stateCode === "KY" && hasLng) {
    return lng < -86.0 ? "central" : "eastern";
  }
  if (stateCode === "IN" && hasLng) {
    const inCentral = hasLat
      ? (lat >= 41.0 && lng < -86.8) || (lat < 38.5 && lng < -87.1)
      : lng < -87.0;
    return inCentral ? "central" : "eastern";
  }
  if (stateCode === "MI" && hasLng) {
    return (!hasLat || lat >= 45.1) && lng < -87.5 ? "central" : "eastern";
  }
  if (stateCode === "TX" && hasLng) {
    return lng <= -104.85 ? "mountain" : "central";
  }
  if (stateCode === "KS" && hasLng) {
    return lng <= -101.5 ? "mountain" : "central";
  }
  if (stateCode === "NE" && hasLng) {
    return lng <= -100.8 ? "mountain" : "central";
  }
  if (stateCode === "SD" && hasLng) {
    return lng <= -100.3 ? "mountain" : "central";
  }
  if (stateCode === "ND" && hasLng) {
    return lng <= -101.5 && (!hasLat || lat < 47.5) ? "mountain" : "central";
  }
  if (stateCode === "ID" && hasLat) {
    return lat >= 45.55 ? "pacific" : "mountain";
  }
  if (stateCode === "OR" && hasLng) {
    return lng >= -117.5 && (!hasLat || lat >= 43.2) ? "mountain" : "pacific";
  }

  if (EASTERN_STATES.has(stateCode)) return "eastern";
  if (CENTRAL_STATES.has(stateCode)) return "central";
  if (MOUNTAIN_STATES.has(stateCode)) return "mountain";
  if (PACIFIC_STATES.has(stateCode)) return "pacific";

  if (hasLng) {
    if (lng <= -150) return "hawaii";
    if (lng <= -130) return "alaska";
    if (lng <= -114.5) return "pacific";
    if (lng <= -102) return "mountain";
    if (lng <= -85.5) return "central";
    if (lng <= -65) return "eastern";
  }

  return null;
}

function findAnchorTimezoneId(
  timezones: ReadonlyArray<WaveTimezoneOption>,
  group: RegionGroup,
): string | null {
  const norm = (s?: string | null) => String(s ?? "").trim().toLowerCase().replace(/\./g, "");
  switch (group) {
    case "arizona":
      return (
        timezones.find((tz) => norm(tz.code) === "mst" && tz.offset === -7)?.id ??
        timezones.find((tz) => norm(tz.code) === "mst")?.id ??
        null
      );
    case "hawaii":
      return (
        timezones.find((tz) => norm(tz.code) === "hst")?.id ??
        timezones.find((tz) => norm(tz.name).includes("hawaii"))?.id ??
        null
      );
    case "alaska":
      return (
        timezones.find((tz) => ["akst", "akdt"].includes(norm(tz.code)))?.id ??
        timezones.find((tz) => norm(tz.name).includes("alaska"))?.id ??
        null
      );
    case "pacific":
      return (
        timezones.find((tz) => ["pst", "pdt"].includes(norm(tz.code)))?.id ??
        timezones.find((tz) => norm(tz.name).includes("pacific"))?.id ??
        null
      );
    case "mountain":
      return (
        timezones.find((tz) => ["mst", "mdt"].includes(norm(tz.code)))?.id ??
        timezones.find((tz) => norm(tz.name).includes("mountain"))?.id ??
        null
      );
    case "central":
      return (
        timezones.find((tz) => ["cst", "cdt"].includes(norm(tz.code)))?.id ??
        timezones.find((tz) => norm(tz.name).includes("central"))?.id ??
        null
      );
    case "eastern":
      return (
        timezones.find((tz) => ["est", "edt"].includes(norm(tz.code)))?.id ??
        timezones.find((tz) => norm(tz.name).includes("eastern"))?.id ??
        null
      );
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
}

export function resolveStoreTimezone(
  timezones: ReadonlyArray<WaveTimezoneOption>,
  store: WaveTargetStore,
  dateValue: string,
  fallbackTimezoneId?: string | null,
): { timezoneId: string | null; timezoneCode: string } {
  const group = inferRegionGroupForStore(store);

  if (group === "arizona") {
    const azId = findAnchorTimezoneId(timezones, "arizona");
    const azTz = azId ? timezones.find((t) => t.id === azId) : null;
    return {
      timezoneId: azTz?.id ?? fallbackTimezoneId ?? null,
      timezoneCode: (azTz?.code ?? "MST").toUpperCase(),
    };
  }

  const anchorId = group
    ? findAnchorTimezoneId(timezones, group) ?? fallbackTimezoneId ?? null
    : fallbackTimezoneId ?? null;

  const normalizedTimezones = timezones.map((tz) => ({
    id: tz.id,
    code: tz.code ?? null,
    name: tz.name ?? null,
    offset: typeof tz.offset === "number" ? tz.offset : 0,
  }));

  const resolvedId =
    resolveTimezoneIdByDate(normalizedTimezones, dateValue, anchorId) ??
    anchorId ??
    timezones[0]?.id ??
    null;

  const matched = resolvedId ? timezones.find((t) => t.id === resolvedId) : null;
  const fallbackLabel = (() => {
    switch (group) {
      case "eastern":
        return "ET";
      case "central":
        return "CT";
      case "mountain":
        return "MT";
      case "pacific":
        return "PT";
      case "alaska":
        return "AKT";
      case "hawaii":
        return "HST";
      case null:
        return "Auto TZ";
      default: {
        const exhaustive: never = group;
        return exhaustive;
      }
    }
  })();

  return {
    timezoneId: matched?.id ?? null,
    timezoneCode: matched?.code ? matched.code.toUpperCase() : fallbackLabel,
  };
}

export function isOvernightShift(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  return endTime <= startTime;
}

export interface BuildWavePreviewParams {
  stores: ReadonlyArray<WaveTargetStore>;
  dateMode: WaveDateMode;
  singleDate: string;
  windowStart: string;
  windowEnd: string;
  weekdays: ReadonlyArray<number>;
  assignMode: WaveWindowAssignMode;
  startTime: string;
  endTime: string;
  timezones: ReadonlyArray<WaveTimezoneOption>;
  fallbackTimezoneId?: string | null;
}

export function buildWavePreviewRows(params: BuildWavePreviewParams): WavePreviewRow[] {
  const {
    stores,
    dateMode,
    singleDate,
    windowStart,
    windowEnd,
    weekdays,
    assignMode,
    startTime,
    endTime,
    timezones,
    fallbackTimezoneId,
  } = params;

  if (stores.length === 0) return [];

  const candidateDates =
    dateMode === "single"
      ? parseIsoDateUtc(singleDate)
        ? [singleDate.trim()]
        : []
      : matchingDatesInWindow(windowStart, windowEnd, weekdays);

  if (candidateDates.length === 0) return [];

  const overnight = isOvernightShift(startTime, endTime);
  const rows: WavePreviewRow[] = [];

  const pushVisit = (store: WaveTargetStore, date: string) => {
    const dt = parseIsoDateUtc(date);
    const weekdayLabel = dt ? WEEKDAY_SHORT[dt.getUTCDay()] : "";
    const { city, stateCode } = extractCityState(store);
    const address = (store.address ?? "").trim();
    const { timezoneId, timezoneCode } = resolveStoreTimezone(
      timezones,
      store,
      date,
      fallbackTimezoneId,
    );
    rows.push({
      rowKey: `${store.key}|${date}`,
      storeKey: store.key,
      storeName: store.name,
      address,
      city,
      stateCode,
      lat: store.position?.lat ?? null,
      lng: store.position?.lng ?? null,
      date,
      weekdayLabel,
      startTime,
      endTime,
      overnight,
      timezoneId,
      timezoneCode,
      missingAddress: address.length === 0,
    });
  };

  if (dateMode === "single" || assignMode === "every") {
    for (const store of stores) {
      for (const date of candidateDates) {
        pushVisit(store, date);
      }
    }
  } else {
    stores.forEach((store, index) => {
      const assignedDate = candidateDates[index % candidateDates.length];
      pushVisit(store, assignedDate);
    });
  }

  return rows;
}

export interface WaveRowOutcome {
  rowNumber: number;
  success: boolean;
  skipped: boolean;
}

/**
 * Partition submitted wave rows into stores that still have failed visits
 * (so partial failures retain failed stores for retry) and rowKeys that
 * already completed or skipped (so retries do not re-submit succeeded dates).
 */
export function partitionWaveOutcome(
  activeRows: ReadonlyArray<Pick<WavePreviewRow, "rowKey" | "storeKey">>,
  outcomes: ReadonlyArray<WaveRowOutcome> | null | undefined,
  rolledBack: boolean,
): {
  retainStoreKeys: string[];
  completedRowKeys: string[];
} {
  if (rolledBack || !outcomes || outcomes.length === 0) {
    return {
      retainStoreKeys: Array.from(new Set(activeRows.map((r) => r.storeKey))),
      completedRowKeys: [],
    };
  }

  const failedStores = new Set<string>();
  const completedRowKeys: string[] = [];
  const accountedIndices = new Set<number>();

  for (const outcome of outcomes) {
    const idx = outcome.rowNumber - 1;
    if (idx < 0 || idx >= activeRows.length) continue;
    accountedIndices.add(idx);
    const row = activeRows[idx];
    if (outcome.success || outcome.skipped) {
      completedRowKeys.push(row.rowKey);
    } else {
      failedStores.add(row.storeKey);
    }
  }

  for (let i = 0; i < activeRows.length; i += 1) {
    if (!accountedIndices.has(i)) {
      failedStores.add(activeRows[i].storeKey);
    }
  }

  return {
    retainStoreKeys: Array.from(failedStores),
    completedRowKeys,
  };
}
