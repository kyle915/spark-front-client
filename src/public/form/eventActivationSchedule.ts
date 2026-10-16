import { isEventActivationRequestType } from "./torchRequestForm";

/**
 * FAMUS Energy, Alcohol Armor, and Wook Water share a brand group.
 * Event Activation on these three is the only place the request form
 * collects multiple date/time rows and an onsite BA count.
 */
export const EVENT_MULTI_DATE_SLUGS = [
  "wook-water",
  "famus-energy",
  "alcohol-armor",
] as const;

export const BA_COUNT_MIN = 1;
export const BA_COUNT_MAX = 20;

export type VisitSlot = {
  date: string;
  startTime: string;
  endTime: string;
};

export function isEventMultiDateTenant(
  ...slugs: Array<string | null | undefined>
): boolean {
  return slugs.some((slug) =>
    (EVENT_MULTI_DATE_SLUGS as readonly string[]).includes(
      (slug ?? "").trim().toLowerCase(),
    ),
  );
}

/** Event Activation on Wook / FAMUS / Alcohol Armor. */
export function showsEventActivationSchedule(
  requestTypeName: string | null | undefined,
  ...slugs: Array<string | null | undefined>
): boolean {
  return (
    isEventMultiDateTenant(...slugs) &&
    isEventActivationRequestType(requestTypeName)
  );
}

/**
 * Other tenants keep the existing shared-time "another visit" control
 * and the always-on BA stepper. These three brands only show a BA
 * stepper on Event Activation.
 */
export function showsLegacyBulkDates(
  ...slugs: Array<string | null | undefined>
): boolean {
  return !isEventMultiDateTenant(...slugs);
}

export function showsBaCountSelector(
  requestTypeName: string | null | undefined,
  ...slugs: Array<string | null | undefined>
): boolean {
  if (!isEventMultiDateTenant(...slugs)) return true;
  return showsEventActivationSchedule(requestTypeName, ...slugs);
}

export function clampBaCount(value: number): number {
  if (!Number.isFinite(value)) return BA_COUNT_MIN;
  return Math.min(BA_COUNT_MAX, Math.max(BA_COUNT_MIN, Math.round(value)));
}

export function blankVisitSlot(from?: VisitSlot): VisitSlot {
  return {
    date: "",
    startTime: from?.startTime || "12:00",
    endTime: from?.endTime || "16:00",
  };
}

/** Extra rows with no date are empty and must not be submitted. */
export function visitSlotsForSubmit(slots: VisitSlot[]): VisitSlot[] {
  if (slots.length === 0) return [];
  const [first, ...rest] = slots;
  return [first, ...rest.filter((slot) => slot.date.trim().length > 0)];
}

export function visitSlotIssues(slots: VisitSlot[]): string | null {
  const rows = visitSlotsForSubmit(slots);
  if (rows.length === 0) {
    return "Add a visit date, start time, and end time.";
  }
  const incomplete = rows.some(
    (slot) =>
      !slot.date.trim() || !slot.startTime.trim() || !slot.endTime.trim(),
  );
  if (incomplete) {
    return "Each date needs a visit date, start time, and end time.";
  }
  return null;
}

/** Prefer the stored integer. Older rows only have the notes line. */
export function displayBaCount(
  stored: number | null | undefined,
  notes: string | null | undefined,
): string | null {
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return String(stored);
  }
  const match = (notes ?? "").match(/(?:^|\n)\s*BA count:\s*(\d+)/i);
  return match ? match[1] : null;
}
