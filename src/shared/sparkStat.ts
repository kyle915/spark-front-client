import {
  countsTowardConversion,
  recapTypeCountsTowardConversion,
  type RecapActivationFilter,
  type RecapTypeKey,
} from "@/lib/activationBucket";

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
  /** Server recap type; when set it decides CONV instead of the name. */
  recapType?: RecapTypeKey | null;
  engagements: number | null | undefined;
  consumersSampled?: number | null | undefined;
  productsSold: number | null | undefined;
  /** Dry demo (no product tasted): CONV base is People engaged only. */
  isDryDemo?: boolean | null | undefined;
  /** People pitched. Dry-demo conversion denominator. Not used for product retail. */
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
 * One recap's CONV denominator. Product retail: consumers sampled, else
 * engagements when the recap has no separate sampled count. Dry demo:
 * people engaged only — missing or 0 is not a rate, and consumers sampled
 * is not a fallback. 0 means its purchases can't be paired.
 */
export function conversionBase(r: RecapKpiRow): number {
  if (r.isDryDemo) {
    const engaged = r.peopleEngaged ?? 0;
    return engaged > 0 ? engaged : 0;
  }
  return r.consumersSampled ?? r.engagements ?? 0;
}

/** At or above this, the recap-detail conversion check is a pass. */
export const CONVERSION_OK_PERCENT = 20;

export type RecapConversion =
  | {
      applies: true;
      pct: number;
      sold: number;
      base: number;
      /** "sampled" for product retail with a consumers-sampled count; "engaged" for dry demos and the legacy engagements fallback. */
      baseNoun: "sampled" | "engaged";
      ok: boolean;
    }
  | { applies: false; reason: string };

/**
 * The Recaps-list CONV for one row: sold ÷ {@link conversionBase}, integer
 * percent, Retail + On-Premise only. Dry demos divide by people engaged.
 */
export function recapConversion(r: RecapKpiRow): RecapConversion {
  if (!rowCountsTowardConversion(r)) {
    return {
      applies: false,
      reason: "Conversion does not apply · retail and on-premise only",
    };
  }
  const sold = r.productsSold ?? 0;
  const base = conversionBase(r);
  if (!(base > 0)) {
    return {
      applies: false,
      reason: r.isDryDemo
        ? "No conversion — people engaged is missing"
        : "No conversion — consumers sampled is missing",
    };
  }
  if (!(sold > 0)) {
    return { applies: false, reason: "No conversion — nothing sold" };
  }
  const pct = Math.round((sold / base) * 100);
  const baseNoun = r.isDryDemo
    ? "engaged"
    : r.consumersSampled != null
      ? "sampled"
      : "engaged";
  return {
    applies: true,
    pct,
    sold,
    base,
    baseNoun,
    ok: pct >= CONVERSION_OK_PERCENT,
  };
}

/** Chip copy for the recap detail review strip. */
export function recapConversionChip(r: RecapKpiRow): {
  status: "pass" | "flag" | "na";
  label: string;
} {
  const conv = recapConversion(r);
  if (!conv.applies) return { status: "na", label: conv.reason };
  return {
    status: conv.ok ? "pass" : "flag",
    label: `Conv ${conv.pct}% · ${conv.sold.toLocaleString()} sold / ${conv.base.toLocaleString()} ${conv.baseNoun}`,
  };
}

/** List-card percent. `empty` when CONV does not apply or has no base. */
export function recapConversionPercent(r: RecapKpiRow, empty: string): string {
  const conv = recapConversion(r);
  return conv.applies ? `${conv.pct}%` : empty;
}

/** Whether a row belongs in CONV at all (Retail + On-Premise only). */
export function rowCountsTowardConversion(r: RecapKpiRow): boolean {
  return r.recapType
    ? recapTypeCountsTowardConversion(r.recapType)
    : countsTowardConversion(r.requestType);
}

/**
 * Sum the CONV base / sold for Retail + On-Premise rows only.
 * Event / Guerilla / Seeding (and, by name, unclassified) rows are
 * excluded from CONV. Dry demos use people engaged; a row with no base
 * adds no sold either. Product retail does not use people engaged.
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
    if (!rowCountsTowardConversion(r)) continue;
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
 * IN VIEW / ENG / SOLD stay all-program; CONV is sold ÷ the per-recap
 * base over Retail + On-Premise only (Event activations excluded).
 * Product retail uses consumers sampled; dry demos use people engaged.
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
  /** Dry demos inside the CONV totals (people-engaged base). */
  conversionDryDemos?: number;
  /** 3rd-party recaps in view, left out of Eng / Sold / Conv. */
  notInTotals?: number;
  /** Active type chip. Event / Guerilla / Seeding have no CONV. */
  recapType?: RecapActivationFilter;
}): SparkStatItem[] {
  const notInTotalsHint = input.notInTotals
    ? `excl. ${input.notInTotals} 3rd-party`
    : undefined;
  const withNotInTotals = (hint: string) =>
    notInTotalsHint ? `${hint} · ${notInTotalsHint}` : hint;
  const type = input.recapType ?? "all";
  const convApplies = type === "all" || recapTypeCountsTowardConversion(type);
  const hasConv =
    convApplies &&
    input.conversionEngagements > 0 &&
    input.conversionSold > 0;
  const conv = hasConv
    ? `${Math.round(
        (input.conversionSold / input.conversionEngagements) * 100,
      )}%`
    : "—";
  // Seeding drops cases at accounts — nothing is sampled or sold.
  const seeding = type === "seeding";
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
      value:
        seeding && input.engagements === 0
          ? "—"
          : input.engagements.toLocaleString(),
      hint: seeding ? withNotInTotals("Drop-offs, not sampling") : notInTotalsHint,
      tone: "lime",
    },
    {
      label: "Sold",
      value: seeding && input.sold === 0 ? "—" : input.sold.toLocaleString(),
      hint: seeding
        ? withNotInTotals("Cases dropped aren't sales")
        : notInTotalsHint,
    },
    {
      label: "Conv",
      value: conv,
      hint: !convApplies
        ? "n/a · Retail + on-prem only"
        : withNotInTotals(
            input.conversionDryDemos
              ? `Retail + on-prem · incl. ${input.conversionDryDemos} dry demo${
                  input.conversionDryDemos === 1 ? "" : "s"
                } vs people engaged`
              : "Retail + on-prem",
          ),
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
 * Insights CONV tile suffix: live-sampled vs dry-demo split. Product
 * retail is sold ÷ consumers sampled. Dry demos are sold ÷ people engaged.
 * Empty when there are no dry demos in range.
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
      ` · dry demos ${pct(drySold, dryBase)} (${drySold.toLocaleString()}/${dryBase.toLocaleString()} people engaged)`,
    );
  }
  if (unpaired > 0) {
    parts.push(
      ` · ${unpaired} dry demo${unpaired === 1 ? "" : "s"} with no people engaged left out`,
    );
  }
  return parts.join("");
}
