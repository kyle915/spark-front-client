/**
 * Time-sheet-only check-in (`ctx.timesheetOnly`): the link is a plain time
 * clock. Who (name + mobile phone), where (the phone's GPS, reverse-geocoded
 * into an address; typed only when location is off), today's date, clock in,
 * clock out, done. No recap, no store name — these are event locations.
 *
 * Pure helpers + copy so the page and its tests share one wording.
 */

export const TIMESHEET_INTRO =
  "Clock in when you arrive and clock out when you leave. That's it.";
export const TIMESHEET_LOCATING = "Finding where you are…";
export const TIMESHEET_LOCATION_OFF =
  "Location is off for this page, so type the address where you're working.";
export const TIMESHEET_LOCATION_UNNAMED =
  "We couldn't name this spot. Type the address where you're working.";
export const TIMESHEET_CLOCKED_IN_HINT = "Your hours are running. Clock out when you finish.";
export const TIMESHEET_DONE_TITLE = "You're clocked out — thanks";
export const TIMESHEET_DONE_BODY = "Your hours are saved. Your lead will confirm them.";

export type TimesheetIdentifyInput = {
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
  today: string;
  eventTypeId?: string;
  needsProgram?: boolean;
};

/** The first thing that's missing, worded for the worker — or null. */
export function timesheetIdentifyError(v: TimesheetIdentifyInput): string | null {
  if (!v.firstName.trim()) return "Enter your first name.";
  if (!v.lastName.trim()) return "Enter your last name.";
  if (v.phone.replace(/\D/g, "").length < 10) return "Enter your mobile phone number.";
  if (v.needsProgram && !(v.eventTypeId || "").trim()) return "Pick what you're working.";
  if (!v.location.trim()) return "Add your location.";
  return null;
}

/** Body for POST /identify. Location only — never a store name. */
export function timesheetIdentifyBody(v: TimesheetIdentifyInput): Record<string, unknown> {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    phone: v.phone.trim(),
    eventDate: v.today,
    address: v.location.trim(),
    // The page is always dated today and shows that date above Continue, so
    // tapping Continue is the "my shift is today" confirmation the server asks
    // for before it opens a new walk-in shift (CHECKIN_REQUIRE_SHIFT_TODAY).
    shiftIsToday: true,
    ...(v.needsProgram && v.eventTypeId ? { eventTypeId: v.eventTypeId } : {}),
  };
}

/** Hours between two ISO punches, one decimal, or null. */
export function workedHours(inAt?: string | null, outAt?: string | null): number | null {
  if (!inAt || !outAt) return null;
  const ms = new Date(outAt).getTime() - new Date(inAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round((ms / 3_600_000) * 10) / 10;
}
