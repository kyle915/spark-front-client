/**
 * Feel Free standing links share one market event per day. A BA who works
 * morning + afternoon files two recaps on that event (`forceNew`). This
 * module is the BA-facing copy + the durable admin label for that second
 * filing — keep the string stable so lists/export stay readable.
 */

import { isFeelFreeWalkupBrand, type WalkupBrand } from "./samplingStops";

export const SECOND_SHIFT_LABEL = "Second shift";

export const SECOND_SHIFT_PROMPT = "Are you working a second shift today?";

/** Feel Free (market standing link) — not Liquid Death / Grub Hub / Luckin. */
export function supportsStandingSecondShift(opts: {
  mode?: string | null;
  brand: WalkupBrand;
  recapOnly?: boolean;
}): boolean {
  if (opts.mode !== "tenant") return false;
  if (opts.recapOnly) return false;
  return isFeelFreeWalkupBrand(opts.brand);
}
