/**
 * Dismissing a missing recap: the reasons staff choose from, and the small
 * pieces of logic the Missing Recaps page needs around them. Kept free of
 * React and Relay so it can be unit-tested.
 *
 * A dismissal says "no recap is owed here". It is a record of its own:
 * hours, bookings and recaps are not changed, and it can be restored.
 */

export type DismissReason =
  | "did_not_work"
  | "filed_elsewhere"
  | "duplicate_or_test"
  | "not_needed"
  | "other";

/** Same values and wording as the API (recaps.models.RecapDismissal). */
export const DISMISS_REASONS: ReadonlyArray<{
  value: DismissReason;
  label: string;
}> = [
  { value: "did_not_work", label: "Did not work the shift" },
  { value: "filed_elsewhere", label: "Recap filed elsewhere" },
  { value: "duplicate_or_test", label: "Duplicate or test shift" },
  { value: "not_needed", label: "Not needed for this event" },
  { value: "other", label: "Other" },
];

export const DISMISS_NOTE_MAX = 280;

/** Collapse whitespace the way the API does before it stores a note. */
export function cleanDismissNote(note: string | null | undefined): string {
  return (note ?? "").split(/\s+/).filter(Boolean).join(" ");
}

/** Why this reason and note cannot be sent, or null when they can. */
export function dismissNoteProblem(
  reason: DismissReason,
  note: string | null | undefined,
): string | null {
  const clean = cleanDismissNote(note);
  if (clean.length > DISMISS_NOTE_MAX) {
    return `Keep the note under ${DISMISS_NOTE_MAX} characters.`;
  }
  if (reason === "other" && !clean) return "Add a short note for “Other”.";
  return null;
}

type EventRow = {
  readonly eventUuid: string;
  readonly assignedAmbassadors: ReadonlyArray<{
    readonly ambassadorEventUuid: string;
  }>;
};

export type DismissTargets = {
  ambassadorEventUuids: string[];
  eventUuids: string[];
};

/**
 * What to send to dismiss every row of the given events: each ambassador
 * row on its own, and an event with nobody assigned as a whole event (it
 * has no ambassador row to dismiss).
 */
export function dismissTargetsForEvents(
  rows: ReadonlyArray<EventRow>,
): DismissTargets {
  const ambassadorEventUuids: string[] = [];
  const eventUuids: string[] = [];
  for (const row of rows) {
    if (row.assignedAmbassadors.length === 0) eventUuids.push(row.eventUuid);
    else {
      for (const ba of row.assignedAmbassadors) {
        ambassadorEventUuids.push(ba.ambassadorEventUuid);
      }
    }
  }
  return { ambassadorEventUuids, eventUuids };
}

export function dismissTargetCount(targets: DismissTargets): number {
  return targets.ambassadorEventUuids.length + targets.eventUuids.length;
}

/** Toast line after a dismissal. */
export function dismissedMessage(count: number): string {
  return count === 1
    ? "Missing recap dismissed."
    : `${count.toLocaleString()} missing recaps dismissed.`;
}

/** "Sam Staff · Nov 14, 2026, 3:05 PM" for a dismissed row. */
export function dismissedByLine(
  dismissedByName: string,
  dismissedAt: string | null | undefined,
): string {
  const who = dismissedByName.trim() || "Staff";
  if (!dismissedAt) return who;
  const when = new Date(dismissedAt);
  if (Number.isNaN(when.getTime())) return who;
  return `${who} · ${when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
