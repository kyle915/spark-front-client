/**
 * Small pure helpers for the staff Weekly summaries page: week arithmetic
 * on YYYY-MM-DD strings (no time zones involved) and the lines that
 * describe a draft. Unit-tested without a component or a generated file.
 */

const parse = (ymd: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const out = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(out.getTime()) ? null : out;
};

const format = (d: Date): string => d.toISOString().slice(0, 10);

/** The Monday `weeks` weeks away from the week holding `ymd`. */
export function shiftWeek(ymd: string, weeks: number): string {
  const day = parse(ymd);
  if (!day) return ymd;
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7) + weeks * 7);
  return format(monday);
}

/** "Nov 9 to 15, 2026", or "Nov 30 to Dec 6, 2026" across a month end. */
export function weekLabel(start: string, end: string): string {
  const a = parse(start);
  const b = parse(end);
  if (!a || !b) return `${start} to ${end}`;
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  const last = sameMonth ? `${b.getUTCDate()}` : `${month(b)} ${b.getUTCDate()}`;
  return `${month(a)} ${a.getUTCDate()} to ${last}, ${b.getUTCFullYear()}`;
}

/** True when the next week has not finished yet, so there is nothing to draft. */
export function isLatestWeek(weekStart: string, today: Date = new Date()): boolean {
  const next = shiftWeek(weekStart, 1);
  const thisMonday = shiftWeek(
    format(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))),
    0,
  );
  return next >= thisMonday;
}

/** What the text box holds differs from what is stored. */
export const isEdited = (draft: string, stored: string): boolean =>
  draft.trim() !== stored.trim();

/** "5 approved recaps. 1 more is waiting for review and is not included." */
export function recapBasis(approved: number, pending: number): string {
  const base =
    approved === 0
      ? "No approved recaps this week."
      : `${approved.toLocaleString("en-US")} approved ${approved === 1 ? "recap" : "recaps"}.`;
  if (pending <= 0) return base;
  return `${base} ${pending.toLocaleString("en-US")} more ${
    pending === 1 ? "is" : "are"
  } waiting for review and ${pending === 1 ? "is" : "are"} not included.`;
}

const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** "Draft", or "Reviewed by Sam Staff on Nov 16". */
export function statusLine(summary: {
  status: string;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
}): string {
  if (summary.status !== "reviewed") return "Draft";
  const who = summary.reviewedByName ? ` by ${summary.reviewedByName}` : "";
  const when = shortDate(summary.reviewedAt);
  return `Reviewed${who}${when ? ` on ${when}` : ""}`;
}

/** "Written by AI from approved recaps on Nov 16. Edited since." */
export function writtenLine(summary: { generatedAt: string; editedBody: string }): string {
  const when = shortDate(summary.generatedAt);
  const base = `Written by AI from approved recaps${when ? ` on ${when}` : ""}.`;
  return summary.editedBody.trim() ? `${base} Edited since.` : base;
}
