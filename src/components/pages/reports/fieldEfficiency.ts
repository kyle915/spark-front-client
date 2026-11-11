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

export const samplesPerHourText = (r: EfficiencyRow): string => rate(r.samplesPerHour);
export const unitsPerHourText = (r: EfficiencyRow): string => rate(r.unitsPerHour);

/**
 * The slice with the best units-per-hour, ignoring slices too thin to trust
 * (fewer than `minRecaps` activations). Falls back to samples per hour when
 * nothing was sold. Null when no slice qualifies.
 */
export const bestSlice = (
  rows: readonly EfficiencyRow[],
  minRecaps = 2,
): EfficiencyRow | null => {
  const solid = rows.filter((r) => r.recaps >= minRecaps && r.hours > 0);
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
