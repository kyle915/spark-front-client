/**
 * Shaping for "Other brands people mentioned" and "What sells where". Pure
 * functions over plain rows, unit-tested without a component or a
 * generated Relay file. Nothing here changes a count.
 */
import { rankRows, type ChartRow } from "@/lib/chartRows";

const count = (n: number): string => n.toLocaleString("en-US");
const plural = (n: number, one: string, many: string): string =>
  `${count(n)} ${n === 1 ? one : many}`;

/* ───────────────────── other brands people mentioned ───────────────────── */

export type BrandRow = {
  brand: string;
  /** Approved recaps with a comment that names this brand. */
  recapCount: number;
  preferOurs: number;
  preferTheirs: number;
  neutral: number;
  quote: string;
};

/** How many brands the chart and the list show. The rest are counted in words. */
export const MAX_BRANDS_SHOWN = 8;

const usableBrands = (brands: readonly BrandRow[]): BrandRow[] =>
  brands.filter((b) => b.brand.trim() !== "" && b.recapCount > 0);

/** The brands to show, most recaps first. */
export function topBrands(brands: readonly BrandRow[], keep = MAX_BRANDS_SHOWN): BrandRow[] {
  return rankRows(
    usableBrands(brands).map((brand) => ({ label: brand.brand, value: brand.recapCount, brand })),
    keep,
  ).map((row) => row.brand);
}

/**
 * Bars for the shown brands. The brands left out are not folded into an
 * "Other" bar: one recap can name two brands, so their sum would count it
 * twice.
 */
export const brandBars = (brands: readonly BrandRow[], keep = MAX_BRANDS_SHOWN): ChartRow[] =>
  topBrands(brands, keep).map((b) => ({ label: b.brand, value: b.recapCount }));

/** "and 3 more brands", or nothing. */
export function moreBrands(brands: readonly BrandRow[], keep = MAX_BRANDS_SHOWN): string {
  const rest = usableBrands(brands).length - keep;
  return rest > 0 ? `and ${plural(rest, "more brand", "more brands")}` : "";
}

/** "7 preferred yours, 2 preferred theirs, 1 only mentioned it". */
export function stanceWords(brand: Pick<BrandRow, "preferOurs" | "preferTheirs" | "neutral">): string {
  const parts: string[] = [];
  if (brand.preferOurs > 0) parts.push(`${count(brand.preferOurs)} preferred yours`);
  if (brand.preferTheirs > 0) parts.push(`${count(brand.preferTheirs)} preferred theirs`);
  if (brand.neutral > 0) parts.push(`${count(brand.neutral)} only mentioned it`);
  return parts.join(", ");
}

/** The one line that says where the brands came from. */
export function mentionsBasis(
  mentionCommentCount: number,
  commentCount: number,
  recapCount: number,
  truncated = false,
): string {
  const read = `${truncated ? "the most recent " : ""}${plural(commentCount, "comment", "comments")}`;
  return `${plural(mentionCommentCount, "comment names", "comments name")} another brand, out of ${read} on ${plural(recapCount, "approved recap", "approved recaps")}. Read by AI; each count is recaps, and a brand is listed only when it is written in the comment.`;
}

/* ─────────────────────────── what sells where ─────────────────────────── */

export type RegionRow = {
  state: string;
  recaps: number;
  soldStatus: string;
  soldProduct: string | null | undefined;
  soldUnits: number;
  soldRecaps: number;
  sampledStatus: string;
  sampledProduct: string | null | undefined;
  sampledUnits: number;
  sampledRecaps: number;
  spokenStatus: string;
  spokenProduct: string | null | undefined;
  spokenPositive: number;
  spokenNegative: number;
  spokenRecaps: number;
};

export type RegionColumn = { key: "sold" | "sampled" | "spoken"; title: string };

/**
 * The columns worth drawing: units sold when any recap breaks sales down by
 * product, samples handed out when any recap lists them, and what people
 * said when the comments could be read.
 */
export function regionColumns(
  hasSold: boolean,
  hasSampled: boolean,
  commentsStatus: string,
): RegionColumn[] {
  const columns: RegionColumn[] = [];
  if (hasSold) columns.push({ key: "sold", title: "Most units sold" });
  if (hasSampled) columns.push({ key: "sampled", title: "Most samples handed out" });
  if (commentsStatus === "ready") columns.push({ key: "spoken", title: "Spoken best of" });
  return columns;
}

export type RegionCell = {
  /** The product, or the sentence that stands in for one. */
  lead: string;
  /** True when `lead` is a product. */
  named: boolean;
  /** What the lead rests on: "19 units · of 3 recaps". */
  basis: string;
};

export const NOT_ENOUGH = "Not enough data yet";
export const NO_LEADER = "No clear leader";

const ofRecaps = (n: number): string => `of ${plural(n, "recap", "recaps")}`;

/** One cell of the table. It never shows a product without its base. */
export function regionCell(row: RegionRow, key: RegionColumn["key"]): RegionCell {
  const status = row[`${key}Status`];
  const product = row[`${key}Product`];
  const recaps = row[`${key}Recaps`];
  if (status !== "ready" || !product) {
    return {
      lead: status === "no_leader" ? NO_LEADER : NOT_ENOUGH,
      named: false,
      basis: recaps > 0 ? ofRecaps(recaps) : "",
    };
  }
  if (key === "spoken") {
    const against = row.spokenNegative > 0 ? `, ${count(row.spokenNegative)} did not` : "";
    return {
      lead: product,
      named: true,
      basis: `${count(row.spokenPositive)} spoke well of it${against} · ${ofRecaps(recaps)}`,
    };
  }
  const units = key === "sold" ? row.soldUnits : row.sampledUnits;
  const unit = key === "sold" ? plural(units, "unit", "units") : plural(units, "sample", "samples");
  return { lead: product, named: true, basis: `${unit} · ${ofRecaps(recaps)}` };
}

/** The one line under the title that says how a product gets named. */
export function regionsBasis(minStateRecaps: number, columns: readonly RegionColumn[]): string {
  const read = columns.some((c) => c.key === "spoken")
    ? " Spoken best of is read by AI from comments that name a product, and counted in recaps."
    : "";
  return `From approved recaps. A state names a product only on ${count(minStateRecaps)} or more recaps from more than one event.${read}`;
}
