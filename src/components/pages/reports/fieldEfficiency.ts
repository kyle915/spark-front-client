export type EfficiencyRow = {
  label: string;
  recaps: number;
  sampled: number;
  sold: number;
  hours: number;
  samplesPerHour?: number | null;
  unitsPerHour?: number | null;
};

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
  const verb = sold(day) || sold(part) ? "sell the most per hour" : "sample the most per hour";
  if (day && part) {
    return `${dayNames[day.label] ?? day.label} and ${part.label.toLowerCase()} shifts ${verb}.`;
  }
  if (day) return `${dayNames[day.label] ?? day.label} ${verb}.`;
  if (part) return `${part.label} shifts ${verb}.`;
  return null;
};
