/**
 * Pure helpers for the store page, the links to it and the highlight of
 * the month. No Relay types here, so this is testable on its own.
 */

const STORE_KEY = /^s\d{1,18}$/;

/** True for a key the server will look up (a request-backed store). */
export function isStoreKey(key: string | null | undefined): key is string {
  return STORE_KEY.test((key ?? "").trim());
}

/** The store page for a key, or null when the key is not a store's. */
export function storeHref(key: string | null | undefined): string | null {
  return isStoreKey(key) ? `/store/${key.trim()}` : null;
}

export function recapHref(kind: string | null | undefined, uuid: string): string {
  return kind === "legacy" ? `/recap/view/${uuid}` : `/recap/view-custom/${uuid}`;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" -> "Oct 5, 2026". Read as a calendar day, never shifted by zone. */
export function dayLabel(iso: string | null | undefined): string {
  const match = ISO_DAY.exec((iso ?? "").trim());
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : "";
}

const TYPE_LABELS: Record<string, string> = {
  retail: "Retail",
  onprem: "On-Premise",
  event: "Event",
  guerilla: "Guerilla",
  seeding: "Seeding",
};

export const activationLabel = (key: string): string => TYPE_LABELS[key] ?? "";

/**
 * What a visit's status reads as. A brand user never gets
 * `recap_in_review` from the server; if one ever arrived it reads the same
 * as "no approved recap".
 */
export function visitStatusLabel(status: string, isStaff: boolean): string {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "recap_approved":
      return "Recap approved";
    case "recap_in_review":
      return isStaff ? "Recap in review" : "No approved recap";
    default:
      return "No approved recap";
  }
}

export const count = (n: number): string => n.toLocaleString("en-US");

/** "16.2%" or "—" when there is no conversion base. */
export const percent = (value: number | null | undefined): string =>
  value == null ? "—" : `${value}%`;

type VisitLike = { readonly date?: string | null; readonly consumers?: number | null };

/**
 * Consumers sampled per visit, oldest first, for the small chart. Empty
 * unless at least three visits have a figure: fewer is a sentence, not a
 * chart.
 */
export function visitSeries(visits: ReadonlyArray<VisitLike>): {
  labels: string[];
  values: number[];
} {
  const rows = visits
    .filter((v) => v.consumers != null && v.date)
    .map((v) => ({ date: v.date as string, value: v.consumers as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-24);
  if (rows.length < 3) return { labels: [], values: [] };
  return {
    labels: rows.map((r) => dayLabel(r.date).replace(/, \d{4}$/, "")),
    values: rows.map((r) => r.value),
  };
}

type NamedLink = { readonly name: string; readonly storeKey: string };

/**
 * The chart rows that are one store each, with where they link. A row
 * whose name is a banner with several locations has no link.
 */
export function linksForLabels(
  labels: ReadonlyArray<string>,
  links: ReadonlyArray<NamedLink>,
): Array<{ name: string; href: string }> {
  const byName = new Map(links.map((l) => [l.name.trim().toLowerCase(), l.storeKey]));
  const out: Array<{ name: string; href: string }> = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.trim().toLowerCase();
    const href = storeHref(byName.get(key));
    if (!href || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: label.trim(), href });
  }
  return out;
}

/** "2026-11" for a Date, in the viewer's own calendar. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The month before "YYYY-MM"; "" when the input is not a month. */
export function previousMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return "";
  const d = new Date(Number(match[1]), Number(match[2]) - 2, 1);
  return monthKey(d);
}

/** The month a "YYYY-MM-DD" date falls in; "" when it is not a date. */
export function monthOfDate(iso: string | null | undefined): string {
  const match = ISO_DAY.exec((iso ?? "").trim());
  return match ? `${match[1]}-${match[2]}` : "";
}
