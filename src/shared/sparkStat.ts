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
  consumersSampled?: number | null | undefined;
  productsSold: number | null | undefined;
  /** Dry demo (no product tasted): CONV base is People engaged. */
  isDryDemo?: boolean | null | undefined;
  peopleEngaged?: number | null | undefined;
  /** 3rd-party / agency recap kept out of every total. */
  excludeFromAggregates?: boolean | null | undefined;
};

/** Rows that roll into totals — 3rd-party recaps stay listed, never summed. */
export function aggregateRows<T extends { excludeFromAggregates?: boolean | null }>(
  rows: T[],
): T[] {
  return rows.filter((r) => !r.excludeFromAggregates);
}

/**
 * One recap's CONV denominator. Live sampling: consumers sampled, else
 * engagements. Dry demo: People engaged (shoppers pitched), else the
 * consumers-sampled value. 0 means its purchases can't be paired.
 */
export function conversionBase(r: RecapKpiRow): number {
  if (r.isDryDemo) return r.peopleEngaged || r.consumersSampled || 0;
  return r.consumersSampled ?? r.engagements ?? 0;
}

/**
 * Sum the CONV base / sold for Retail + On-Premise rows only.
 * Event (and unclassified) activations are excluded from CONV. Dry demos
 * count against People engaged; a row with no base adds no sold either.
 */
export function sumConversionBases(rows: RecapKpiRow[]): {
  engagements: number;
  sold: number;
  dryDemos: number;
} {
  let engagements = 0;
  let sold = 0;
  let dryDemos = 0;
  for (const r of rows) {
    if (r.excludeFromAggregates) continue;
    if (!countsTowardConversion(r.requestType)) continue;
    const base = conversionBase(r);
    if (base <= 0) continue;
    engagements += base;
    sold += r.productsSold ?? 0;
    if (r.isDryDemo) dryDemos += 1;
  }
  return { engagements, sold, dryDemos };
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
  /** Dry demos inside the CONV totals (paired with People engaged). */
  conversionDryDemos?: number;
  /** 3rd-party recaps in view, left out of Eng / Sold / Conv. */
  notInTotals?: number;
}): SparkStatItem[] {
  const notInTotalsHint = input.notInTotals
    ? `excl. ${input.notInTotals} 3rd-party`
    : undefined;
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
      hint: notInTotalsHint,
      tone: "lime",
    },
    {
      label: "Sold",
      value: input.sold.toLocaleString(),
      hint: notInTotalsHint,
    },
    {
      label: "Conv",
      value: conv,
      hint:
        (input.conversionDryDemos
          ? `Retail + on-prem · incl. ${input.conversionDryDemos} dry demo${
              input.conversionDryDemos === 1 ? "" : "s"
            } vs people engaged`
          : "Retail + on-prem") +
        (notInTotalsHint ? ` · ${notInTotalsHint}` : ""),
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

/**
 * Insights CONV tile suffix: live-sampled vs dry-demo split, so a program
 * with dry demos shows what each side contributes. Empty when there are no
 * dry demos in range.
 */
export function conversionSplitNote(conv: {
  sold: number;
  engagements: number;
  drySold?: number | null;
  dryEngagements?: number | null;
  dryRecaps?: number | null;
  unpairedDryRecaps?: number | null;
}): string {
  const dryRecaps = conv.dryRecaps ?? 0;
  const unpaired = conv.unpairedDryRecaps ?? 0;
  if (dryRecaps <= 0 && unpaired <= 0) return "";
  const pct = (s: number, b: number) =>
    b > 0 ? `${Math.round((s / b) * 1000) / 10}%` : "—";
  const drySold = conv.drySold ?? 0;
  const dryBase = conv.dryEngagements ?? 0;
  const liveSold = conv.sold - drySold;
  const liveBase = conv.engagements - dryBase;
  const parts = [
    ` · live sampled ${pct(liveSold, liveBase)} (${liveSold.toLocaleString()}/${liveBase.toLocaleString()})`,
  ];
  if (dryRecaps > 0) {
    parts.push(
      ` · dry demos ${pct(drySold, dryBase)} vs people engaged (${drySold.toLocaleString()}/${dryBase.toLocaleString()})`,
    );
  }
  if (unpaired > 0) {
    parts.push(
      ` · ${unpaired} dry demo${unpaired === 1 ? "" : "s"} with no people engaged left out`,
    );
  }
  return parts.join("");
}
