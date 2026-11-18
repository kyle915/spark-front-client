/**
 * Small pure helpers for store recommendations and alerts. Unit-tested
 * without a component or a generated file.
 */

type Insight = { code: string; isDraft: boolean };

/** Detector codes the "Where to go next" card lists under "Go back". */
export const GO_BACK_CODES = ["top_store"] as const;
/** ...and under "Fix", in this order. */
export const FIX_CODES = ["repeat_no_product", "low_sales"] as const;

/** A brand user never sees a draft, whatever the server sent. */
export function visibleInsights<T extends Insight>(items: readonly T[], forClient: boolean): T[] {
  return forClient ? items.filter((i) => !i.isDraft) : [...items];
}

/** Split recommendations into "Go back" and "Fix", keeping server order. */
export function groupRecommendations<T extends Insight>(items: readonly T[]): { goBack: T[]; fix: T[] } {
  const goBack = items.filter((i) => (GO_BACK_CODES as readonly string[]).includes(i.code));
  const fixOrder = FIX_CODES as readonly string[];
  const fix = items
    .filter((i) => fixOrder.includes(i.code))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => fixOrder.indexOf(a.item.code) - fixOrder.indexOf(b.item.code) || a.index - b.index)
    .map(({ item }) => item);
  return { goBack, fix };
}

const LABELS: Record<string, string> = {
  top_store: "Go back",
  repeat_no_product: "No product",
  low_sales: "Low sales",
  no_product_week: "Product missing",
  conversion_drop: "Conversion drop",
  chain_conversion_drop: "Retailer conversion drop",
};

/** A short sentence-case label for a detector code, for staff review. */
export function insightLabel(code: string): string {
  return LABELS[code] ?? "Finding";
}

/** "Published by Sam Staff", "Hidden", "Draft". */
export function insightStatusLine(item: { status: string; reviewedByName?: string | null }): string {
  if (item.status === "published") {
    return item.reviewedByName ? `Published by ${item.reviewedByName}` : "Published";
  }
  if (item.status === "hidden") return item.reviewedByName ? `Hidden by ${item.reviewedByName}` : "Hidden";
  return "Draft";
}
