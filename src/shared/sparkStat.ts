import { countsTowardConversion } from "@/lib/activationBucket";

export type SparkStatTone = "default" | "lime" | "orange";

export type SparkStatItem = {
  label: string;
  value: string;
  /** When set, render with CountReel instead of the static string. */
  count?: number;
  hint?: string;
  tone?: SparkStatTone;
};

export type RecapKpiRow = {
  requestType: string | null | undefined;
  engagements: number | null | undefined;
  productsSold: number | null | undefined;
};

/**
 * Sum engagements / sold for Retail + On-Premise rows only.
 * Event (and unclassified) activations are excluded from CONV.
 */
export function sumConversionBases(rows: RecapKpiRow[]): {
  engagements: number;
  sold: number;
} {
  let engagements = 0;
  let sold = 0;
  for (const r of rows) {
    if (!countsTowardConversion(r.requestType)) continue;
    engagements += r.engagements ?? 0;
    sold += r.productsSold ?? 0;
  }
  return { engagements, sold };
}

/**
 * Recaps list strip — numbers from the loaded/filtered set, never invented.
 * IN VIEW / ENG / SOLD stay all-program; CONV is sold ÷ eng over Retail +
 * On-Premise only (Event activations excluded from both sides).
 */
export function recapListKpis(input: {
  filteredTotal: number;
  loaded: number;
  total: number;
  engagements: number;
  sold: number;
  /** Retail + on-prem engagements (CONV denominator). */
  conversionEngagements: number;
  /** Retail + on-prem sold (CONV numerator). */
  conversionSold: number;
}): SparkStatItem[] {
  const hasConv =
    input.conversionEngagements > 0 && input.conversionSold > 0;
  const conv = hasConv
    ? `${Math.round(
        (input.conversionSold / input.conversionEngagements) * 100,
      )}%`
    : "—";
  return [
    {
      label: "In view",
      value: input.filteredTotal.toLocaleString(),
      hint:
        input.loaded < input.total
          ? `${input.loaded.toLocaleString()} loaded`
          : undefined,
    },
    {
      label: "Eng",
      value: input.engagements.toLocaleString(),
      tone: "lime",
    },
    {
      label: "Sold",
      value: input.sold.toLocaleString(),
    },
    {
      label: "Conv",
      value: conv,
      hint: "Retail + on-prem",
      tone: hasConv ? "lime" : "default",
    },
  ];
}

/** Today map + roster — events / live pings / mapped venues. */
export function todayGroundKpis(input: {
  events: number;
  liveBas: number;
  mapped: number;
}): SparkStatItem[] {
  return [
    { label: "Events", value: input.events.toLocaleString(), count: input.events },
    {
      label: "Live BAs",
      value: input.liveBas.toLocaleString(),
      count: input.liveBas,
      tone: input.liveBas > 0 ? "orange" : "default",
    },
    {
      label: "Mapped",
      value: input.mapped.toLocaleString(),
      count: input.mapped,
      tone: "lime",
    },
  ];
}

export function padIndex(n: number): string {
  return String(n).padStart(2, "0");
}
