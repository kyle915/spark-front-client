/**
 * Feel Free standing links share one market event per day. A BA who works
 * morning + afternoon files two recaps on that event (`forceNew`). This
 * module is the BA-facing copy + the durable admin label for that second
 * filing — keep the string stable so lists/export stay readable.
 *
 * Distinct from leftover / prior-day sessions (`leftoverCheckin.ts`):
 *   second shift = same calendar day, first filing already done
 *   leftover     = restored session whose event date is NOT today
 *
 * Never offer second-shift UI on a leftover prior-day session — even after
 * the BA taps "Stay on that day" — or the two flows become one confusing
 * prompt.
 */

import {
  isLeftoverCheckinSession,
} from "./leftoverCheckin";
import { isFeelFreeWalkupBrand, type WalkupBrand } from "./samplingStops";

export const SECOND_SHIFT_LABEL = "Second shift";

export const SECOND_SHIFT_PROMPT = "Are you working a second shift today?";

export const SECOND_SHIFT_HINT = `Same market, same day (not a leftover from another day). Your second filing is labeled ${SECOND_SHIFT_LABEL} so it doesn’t overwrite the first.`;

/**
 * Feel Free market standing clock links only — and only when the restored
 * event is today's date. Liquid Death / Torch / Brew Dr / Grub Hub stay on
 * the plain "Clock in again / File another recap" path.
 */
export function supportsStandingSecondShift(opts: {
  mode?: string | null;
  brand: WalkupBrand;
  recapOnly?: boolean;
  /** Event.date from the restored session — required to block leftover. */
  eventDate?: string | null;
  /** Civil YYYY-MM-DD for "today". When omitted, date gate is skipped. */
  today?: string;
}): boolean {
  if (opts.mode !== "tenant") return false;
  if (opts.recapOnly) return false;
  if (!isFeelFreeWalkupBrand(opts.brand)) return false;
  // Prior-day leftover must never present as a second shift today.
  if (
    opts.today &&
    isLeftoverCheckinSession(opts.eventDate, opts.today)
  ) {
    return false;
  }
  return true;
}
