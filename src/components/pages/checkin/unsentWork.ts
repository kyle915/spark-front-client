/**
 * What is still waiting on this phone for a walk-up `/checkin/:code` link.
 *
 * "Check in somewhere else" used to wipe the offline queues, so a clock-in
 * or recap saved with no bars was deleted the moment the BA moved on to the
 * next store. The queues are one slot per link (not per session), so a
 * queued item cannot safely ride along into the next check-in either: the
 * new session would read it as its own. The switch waits instead.
 */

import {
  readPendingClock,
  readPendingClockOut,
  type StorageLike,
} from "./offlineClock";
import { readPendingMileage } from "./offlineMileage";
import { readPendingRecap } from "./offlineRecap";

export type UnsentWork = {
  clockIn: boolean;
  clockOut: boolean;
  mileage: boolean;
  /** A recap still trying to send. */
  recap: boolean;
  /** A recap the server refused. Held on the device, not retrying. */
  rejectedRecap: boolean;
};

export function readUnsentWork(code: string, storage?: StorageLike): UnsentWork {
  const recap = readPendingRecap(code, storage);
  return {
    clockIn: Boolean(readPendingClock(code, storage)),
    clockOut: Boolean(readPendingClockOut(code, storage)),
    mileage: Boolean(readPendingMileage(code, storage)),
    recap: Boolean(recap && !recap.rejected),
    rejectedRecap: Boolean(recap?.rejected),
  };
}

/** Anything that will still send if the page stays open. A refused recap is
 *  not in this list: waiting does not help it, so it must not hold a BA at
 *  the old store. It is kept on the device instead (see SparkCheckin). */
export function unsentItems(work: UnsentWork): string[] {
  const items: string[] = [];
  if (work.clockIn) items.push("a clock-in");
  if (work.clockOut) items.push("a clock-out");
  if (work.mileage) items.push("a mileage claim");
  if (work.recap) items.push("a recap");
  return items;
}

export const hasUnsentWork = (work: UnsentWork): boolean =>
  unsentItems(work).length > 0;

function joinItems(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Plain words for the BA, or null when nothing is waiting. */
export function unsentWorkMessage(
  work: UnsentWork,
  then: string = "switch stores",
): string | null {
  const items = unsentItems(work);
  if (items.length === 0) return null;
  const one = items.length === 1;
  return (
    `You have ${joinItems(items)} that ${one ? "has" : "have"} not been sent yet. ` +
    `Keep this page open until ${one ? "it sends" : "they send"}, then ${then}.`
  );
}
