export type FieldTotal = {
  label: string;
  kind: string;
  total: number;
  average: number;
  recaps: number;
  isPercent: boolean;
  sampledQuestion?: boolean;
};

export type FieldSection<T extends FieldTotal = FieldTotal> = {
  section: string;
  fields: readonly T[];
};

/** Pull consumers-sampled questions out of the metric grid. They are the
 *  parts of the headline total, not rival KPIs. */
export function partitionSampledQuestions<T extends FieldTotal>(
  sections: readonly FieldSection<T>[],
): { parts: T[]; sections: FieldSection<T>[] } {
  const parts: T[] = [];
  const rest = sections
    .map((section) => ({
      section: section.section,
      fields: section.fields.filter((field) => {
        if (!field.sampledQuestion) return true;
        parts.push(field);
        return false;
      }),
    }))
    .filter((section) => section.fields.length > 0);
  return { parts, sections: rest };
}

/** Says how the sampled questions relate to the headline total. */
export function sampledPartsIntro(parts: readonly FieldTotal[], headline: number | null): string {
  const sum = parts.reduce((total, field) => total + field.total, 0);
  if (headline != null && Math.round(sum) === Math.round(headline)) {
    return `These questions add up to the ${headline.toLocaleString("en-US")} consumers sampled above.`;
  }
  return "These questions are what the consumers sampled total counts.";
}

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

/** Says what the figure is, so an average is never read as a total. When the
 *  brand is counted once per store per day, the unit is store-days. */
export const fieldTotalNote = (f: FieldTotal, perStoreDay = false): string => {
  const n = f.recaps.toLocaleString("en-US");
  const unit = perStoreDay
    ? `store-day${f.recaps === 1 ? "" : "s"}`
    : `recap${f.recaps === 1 ? "" : "s"}`;
  return f.kind === "average"
    ? `average across ${n} ${unit}`
    : `total across ${n} ${unit}`;
};

/** One line under the heading saying how the totals were counted. */
export const countingBasisLine = (perStoreDay: boolean): string =>
  perStoreDay
    ? "Every number your approved recaps collected in this range, counted once per store per day. When more than one recap covers the same store and day, the highest figure is used. Prices, rates and ratings are averaged."
    : "Every number your approved recaps collected in this range, added up by question. Prices, rates and ratings are averaged.";
