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

/** The callout staff get for a state whose recaps are waiting for review. */
export const WAITING_REVIEW_KIND = "state_waiting_review";

/**
 * The recaps list filtered to the recaps behind a callout: approved recaps,
 * for that store or state, between those dates. For a state waiting for
 * review it is the needs-review recaps instead. Uses the list's own URL
 * filters (`status`, `retailer`, `state`, `from`, `to`).
 */
export function calloutRecapsHref(link: CalloutLink, kind?: string): string {
  const params = new URLSearchParams({
    status: kind === WAITING_REVIEW_KIND ? "needs_review" : "approved",
  });
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
export function calloutLinkLabel(link: CalloutLink, kind?: string): string {
  const store = (link.store ?? "").trim();
  const state = (link.state ?? "").trim();
  if (kind === WAITING_REVIEW_KIND) {
    return state ? `Review the recaps in ${state}` : "Review the recaps";
  }
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
