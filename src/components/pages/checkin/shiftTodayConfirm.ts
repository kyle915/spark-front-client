/**
 * "Is your shift today?" — asked before a standing walk-up link opens a NEW
 * walk-in event.
 *
 * A BA opened the link weeks before her demo, and identify quietly made an
 * event for that morning and clocked her in on it. The API now answers
 * identify with 400 `confirm_shift_today` (and creates nothing) when the
 * check-in would open a new event without the BA saying the shift is today.
 * Joining an event that already exists, recap-only links and past-day
 * recaps are never asked, so the question only shows when it matters.
 *
 * "Yes" resends the same identify with `shiftIsToday: true`. "No" stops:
 * nothing is created, nobody is clocked in.
 */

export const SHIFT_TODAY_CONFIRM_CODE = "confirm_shift_today";

export const SHIFT_TODAY_YES = "Yes, I'm working now";
export const SHIFT_TODAY_NO = "No, it's another day";
export const SHIFT_TODAY_HINT =
  "Only check in on the day you're working, when your shift starts.";

export const SHIFT_LATER_TITLE = "Come back when your shift starts";
export const SHIFT_LATER_BODY =
  "Open this link again on the day you're working, when your shift starts. Nothing was saved and you're not clocked in.";
export const SHIFT_LATER_BACK = "Go back";

/** The identify response is the API asking "Is your shift today?". */
export function needsShiftTodayConfirm(status: number, json: unknown): boolean {
  if (status !== 400 || !json || typeof json !== "object") return false;
  return (json as { error?: unknown }).error === SHIFT_TODAY_CONFIRM_CODE;
}

/** "Wednesday, November 19" for a YYYY-MM-DD calendar day (no UTC shift). */
export function formatShiftDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "";
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(day.getTime())) return "";
  return day.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * The question, about the day the BA is checking in for. That is today in
 * almost every case; a date picked ahead names that day instead.
 */
export function shiftTodayQuestion(shiftDate: string, today: string): string {
  const day = formatShiftDay(shiftDate || today);
  if (!day) return "Is your shift today?";
  if (!shiftDate || shiftDate.slice(0, 10) === today) return `Is your shift today, ${day}?`;
  return `Is your shift on ${day}?`;
}

/** Same identify body, now carrying the BA's "yes". */
export function withShiftTodayConfirmed(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return { ...body, shiftIsToday: true };
}
