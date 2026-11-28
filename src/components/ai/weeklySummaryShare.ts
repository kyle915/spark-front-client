import { summaryParagraphs, weekLabel } from "@/lib/weeklySummary";

export interface WeeklySummaryArchiveItem {
  weekStart: string;
  weekEnd: string;
  text: string;
  isDraft: boolean;
  reviewedAt?: string | null;
}

/**
 * Formats a reviewed weekly summary cleanly for pasting into Slack, Teams, or
 * leadership email updates.
 */
export function formatWeeklySummaryForShare(input: {
  brandName?: string | null;
  weekStart: string;
  weekEnd: string;
  text: string;
}): string {
  const brand = (input.brandName ?? "").trim();
  const windowText = weekLabel(input.weekStart, input.weekEnd);
  const header = brand
    ? `Weekly Field Update — ${brand} (${windowText})`
    : `Weekly Field Update (${windowText})`;
  const paragraphs = summaryParagraphs(input.text);
  return [
    header,
    "",
    ...paragraphs,
    "",
    "— Compiled from approved recaps on Spark",
  ].join("\n\n");
}

/**
 * Pre-seeds an Ask Spark follow-up question scoped to the displayed summary week.
 */
export function buildWeeklySummaryAskPrompt(input: {
  weekStart: string;
  weekEnd: string;
}): string {
  const windowText = weekLabel(input.weekStart, input.weekEnd);
  return `Break down the top-performing stores, SKU sales velocity, and shopper feedback themes from ${windowText} (${input.weekStart} to ${input.weekEnd}).`;
}

/**
 * Merges the primary latest summary with any fetched archive list, enforcing
 * client draft-hiding and newest-first weekStart ordering.
 */
export function mergeSummaryArchive(
  latest: WeeklySummaryArchiveItem | null | undefined,
  fetched: ReadonlyArray<WeeklySummaryArchiveItem> | null | undefined,
  forClient: boolean,
): WeeklySummaryArchiveItem[] {
  const byWeek = new Map<string, WeeklySummaryArchiveItem>();
  for (const item of [latest, ...(fetched ?? [])]) {
    if (!item || !item.weekStart) continue;
    if (forClient && item.isDraft) continue;
    if (!byWeek.has(item.weekStart)) {
      byWeek.set(item.weekStart, item);
    }
  }
  return [...byWeek.values()].sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart),
  );
}
