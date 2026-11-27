import { cleanEventName } from "@/utils/eventLabel";

export type EfficiencyRow = {
  label: string;
  recaps: number;
  sampled: number;
  sold: number;
  hours: number;
  samplesPerHour?: number | null;
  unitsPerHour?: number | null;
};

const WALKIN_LEAD_RE = /^\s*\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\s*[-–—:]\s*/;
const PROGRAM_SUFFIX_RE =
  /^(?:retail(?:\s+sampling)?|on[- ]premise(?:\s+sampling)?|event(?:\s+activation)?|direct\s+event\s+sampling|guerilla(?:\s+marketing)?|product\s+seeding|merchandising|walk[- ]in\s+event)$/i;
const TRAILING_PLACE_PAREN_RE = /\(([^()]+)\)\s*$/;

/**
 * Clean a store row label when an unlinked walk-in event title reaches the UI
 * (e.g. "10/30/2026 - Symmes Road, Fairfield, OH (Jungle Jim's) · Retail Sampling").
 */
export function formatStoreEfficiencyLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const isWalkin = WALKIN_LEAD_RE.test(trimmed);
  const cleaned = cleanEventName(trimmed);
  const parts = cleaned
    .split(" · ")
    .map((p) => p.trim())
    .filter((p) => p && !PROGRAM_SUFFIX_RE.test(p));
  const base = parts.join(" · ") || cleaned || trimmed;
  if (isWalkin) {
    const paren = TRAILING_PLACE_PAREN_RE.exec(base);
    if (paren?.[1]?.trim()) return paren[1].trim();
  }
  return base;
}

const rate = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** A person cannot sustain a faster clocked rate than this. */
export const SAMPLES_PER_HOUR_CEILING = 120;
export const UNITS_PER_HOUR_CEILING = 60;

/** Null when the clocked time cannot support the rate. Spark already holds
 *  these on the server; this keeps a stale payload from printing them. */
export function publishRate(
  value: number | null | undefined,
  ceiling: number,
): number | null {
  if (value == null || !Number.isFinite(value) || value > ceiling) return null;
  return value;
}

export function cleanRates<T extends EfficiencyRow>(row: T): T {
  return {
    ...row,
    samplesPerHour: publishRate(row.samplesPerHour, SAMPLES_PER_HOUR_CEILING),
    unitsPerHour: publishRate(row.unitsPerHour, UNITS_PER_HOUR_CEILING),
  };
}

export const samplesPerHourText = (r: EfficiencyRow): string =>
  rate(publishRate(r.samplesPerHour, SAMPLES_PER_HOUR_CEILING));
export const unitsPerHourText = (r: EfficiencyRow): string =>
  rate(publishRate(r.unitsPerHour, UNITS_PER_HOUR_CEILING));

export const unitsSoldText = (r: EfficiencyRow): string =>
  r.sold.toLocaleString("en-US");

/**
 * The slice with the best units-per-hour, ignoring slices too thin to trust
 * (fewer than `minRecaps` activations). Falls back to samples per hour when
 * nothing was sold. Null when no slice qualifies.
 */
export const bestSlice = (
  rows: readonly EfficiencyRow[],
  minRecaps = 2,
): EfficiencyRow | null => {
  const solid = rows
    .map(cleanRates)
    .filter((r) => r.recaps >= minRecaps && r.hours > 0);
  if (solid.length === 0) return null;
  const bySold = solid.filter((r) => (r.unitsPerHour ?? 0) > 0);
  const pool = bySold.length > 0 ? bySold : solid.filter((r) => (r.samplesPerHour ?? 0) > 0);
  if (pool.length === 0) return null;
  const key = (r: EfficiencyRow) =>
    bySold.length > 0 ? (r.unitsPerHour ?? 0) : (r.samplesPerHour ?? 0);
  return [...pool].sort((a, b) => key(b) - key(a))[0];
};

/** "Saturdays in the afternoon sell the most per hour." — or null. */
export const efficiencyHeadline = (
  byWeekday: readonly EfficiencyRow[],
  byDaypart: readonly EfficiencyRow[],
): string | null => {
  const day = bestSlice(byWeekday);
  const part = bestSlice(byDaypart);
  const dayNames: Record<string, string> = {
    Mon: "Mondays",
    Tue: "Tuesdays",
    Wed: "Wednesdays",
    Thu: "Thursdays",
    Fri: "Fridays",
    Sat: "Saturdays",
    Sun: "Sundays",
  };
  const sold = (r: EfficiencyRow | null) => (r?.unitsPerHour ?? 0) > 0;
  const daySold = sold(day);
  const partSold = sold(part);
  const line = (r: EfficiencyRow, byUnits: boolean) => {
    const verb = byUnits ? "sell the most per hour" : "sample the most per hour";
    if (r.label in dayNames) return `${dayNames[r.label]} ${verb}.`;
    return `${r.label} shifts ${verb}.`;
  };
  // A sales day and a samples shift are two sentences. One verb would
  // call the samples shift a sales leader.
  if (day && part && daySold !== partSold) {
    return `${line(day, daySold)} ${line(part, partSold)}`;
  }
  const verb = daySold || partSold ? "sell the most per hour" : "sample the most per hour";
  if (day && part) {
    return `${dayNames[day.label] ?? day.label} and ${part.label.toLowerCase()} shifts ${verb}.`;
  }
  if (day) return line(day, daySold);
  if (part) return line(part, partSold);
  return null;
};
