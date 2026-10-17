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

export type CreateRequestBlockerInput = {
  venue: string;
  multiDateEvent: boolean;
  date: string;
  visitSlots: VisitSlot[];
  schedulingStatus: string;
  showTorchNonActiveFields?: boolean;
  nonActiveProductRequired?: string;
  isTorch?: boolean;
  torchActivationOk?: boolean;
  coBrandMissing?: string | null;
};

/**
 * Returns a human-readable section/field name blocking internal Create Request
 * submission, or `null` when ready to submit. Checks `visitSlots` when
 * `multiDateEvent` is true and top-level `date` otherwise.
 */
export function computeCreateRequestBlocker(
  input: CreateRequestBlockerInput,
): string | null {
  if (!input.venue.trim()) return "Venue";
  const scheduleReady = input.multiDateEvent
    ? !visitSlotIssues(input.visitSlots)
    : Boolean(input.date.trim());
  if (!scheduleReady) return "Date";
  if (!input.schedulingStatus.trim()) return "Scheduling";
  if (input.showTorchNonActiveFields && !input.nonActiveProductRequired?.trim()) {
    return "Products";
  }
  if (input.isTorch && input.torchActivationOk === false) {
    return "Request";
  }
  if (input.coBrandMissing) {
    return input.coBrandMissing;
  }
  return null;
}

export type QuickDatePreset = {
  label: string;
  iso: string;
};

/** Build quick-date preset chips relative to `baseDate` (defaults to today). */
export function buildQuickDatePresets(baseDate = new Date()): QuickDatePreset[] {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };
  const nextDow = (target: number) => {
    const d = new Date(today);
    const diff = (target - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  };
  const fmtChip = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return [
    { label: "TODAY", iso: fmt(today) },
    { label: "TOMORROW", iso: fmt(addDays(1)) },
    { label: `FRI · ${fmtChip(nextDow(5))}`, iso: fmt(nextDow(5)) },
    { label: `SAT · ${fmtChip(nextDow(6))}`, iso: fmt(nextDow(6)) },
    { label: `+7D · ${fmtChip(addDays(7))}`, iso: fmt(addDays(7)) },
    { label: `+14D · ${fmtChip(addDays(14))}`, iso: fmt(addDays(14)) },
  ];
}
