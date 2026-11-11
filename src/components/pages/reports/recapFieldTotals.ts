export type FieldTotal = {
  label: string;
  kind: string;
  total: number;
  average: number;
  recaps: number;
  isPercent: boolean;
};

const trim = (n: number, digits: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });

/** The figure shown for a field: sums for counts and money, the mean for
 *  prices, rates and ratings. */
export const fieldTotalValue = (f: FieldTotal): string => {
  if (f.kind === "money") {
    return `$${f.total.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (f.kind === "average") {
    return f.isPercent ? `${trim(f.total, 1)}%` : trim(f.total, 2);
  }
  return trim(f.total, 0);
};

/** Says what the figure is, so an average is never read as a total. */
export const fieldTotalNote = (f: FieldTotal): string => {
  const recaps = `${f.recaps.toLocaleString("en-US")} recap${f.recaps === 1 ? "" : "s"}`;
  return f.kind === "average" ? `average across ${recaps}` : `total across ${recaps}`;
};
