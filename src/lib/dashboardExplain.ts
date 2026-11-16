/**
 * Small pure helpers for the dashboard sentences, kept free of React and of
 * Relay's generated files so they can be unit-tested on their own.
 */

/** The charts a question can be asked about. Must match the server. */
export type ChartKind =
  | "consumers_by_week"
  | "consumers_by_store"
  | "consumers_by_state"
  | "samples_by_product";

export type CalloutLink = {
  store?: string | null;
  state?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * The recaps list filtered to the recaps behind a callout: approved recaps,
 * for that store or state, between those dates. Uses the list's own URL
 * filters (`status`, `retailer`, `state`, `from`, `to`).
 */
export function calloutRecapsHref(link: CalloutLink): string {
  const params = new URLSearchParams({ status: "approved" });
  const store = (link.store ?? "").trim();
  const state = (link.state ?? "").trim();
  if (store) params.set("retailer", store);
  if (state) params.set("state", state);
  // The list reads either both dates or neither.
  if (link.startDate || link.endDate) {
    params.set("from", link.startDate ?? "");
    params.set("to", link.endDate ?? "");
  }
  return `/recaps/list?${params.toString()}`;
}

/** What the link under a callout says. */
export function calloutLinkLabel(link: CalloutLink): string {
  const store = (link.store ?? "").trim();
  const state = (link.state ?? "").trim();
  if (store) return `See the recaps at ${store}`;
  if (state) return `See the recaps in ${state}`;
  return "See the recaps";
}

export const MAX_CHART_QUESTION = 300;

/** A question ready to send, or "" when there is nothing to ask. */
export function cleanChartQuestion(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHART_QUESTION);
}

/** "Never visited" / "Worth going back to", for a where-to-sample-next row. */
export function sampleNextKindLabel(kind: string): string {
  return kind === "revisit" ? "Worth going back to" : "Never visited";
}
