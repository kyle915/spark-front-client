import type { FmEvent } from "./fieldMarketingTypes";
import { isStaffedActivity, showsCans, showsDays, showsPours } from "./fieldMarketingRules";

/** Plan form state and the GraphQL input it sends. */

export const PLAN_ACTIVITIES = [
  { id: "event_activation", label: "Event activation / sponsorship" },
  { id: "guerilla", label: "Guerilla event" },
  { id: "product_seeding", label: "Product seeding" },
  { id: "sales_support", label: "Sales support" },
];

export const SUPPORT_TYPES = [
  { id: "distributor_meeting", label: "Distributor meeting" },
  { id: "retail_visit", label: "Retail visit" },
  { id: "other", label: "Other" },
];

export const emptyPlanForm = {
  market: "miami",
  activity: "event_activation",
  name: "",
  startsOn: "",
  days: "1",
  address: "",
  notes: "",
  plannedFullCans: "",
  plannedPourSamples: "",
  plannedEmails: "",
  setupDay: false,
  samplingFormat: "",
  supportType: "distributor_meeting",
  supportOther: "",
  skuNames: [] as string[],
  needsFieldSupport: false,
  ambassadorCount: "",
  startTime: "",
  endTime: "",
  supportTimes: "",
  supportScope: "",
};

export type PlanFormState = typeof emptyPlanForm;

export function formFromRow(row: FmEvent): PlanFormState {
  return {
    market: row.market,
    activity: row.activity,
    name: row.name,
    startsOn: row.startsOn.slice(0, 10),
    days: String(row.days || 1),
    address: row.address,
    notes: row.notes,
    plannedFullCans: forecastText(row.plannedFullCans),
    plannedPourSamples: forecastText(row.plannedPourSamples),
    plannedEmails: forecastText(row.plannedEmails),
    setupDay: Boolean(row.setupDay),
    samplingFormat: row.samplingFormat,
    supportType: row.supportType || "distributor_meeting",
    supportOther: row.supportOther,
    skuNames: [...(row.skuNames ?? [])],
    needsFieldSupport: row.needsFieldSupport,
    ambassadorCount: row.ambassadorCount ? String(row.ambassadorCount) : "",
    startTime: row.startTime,
    endTime: row.endTime,
    supportTimes: row.startTime ? "" : row.supportTimes,
    supportScope: row.supportScope,
  };
}

/** 0 is "not forecast", so it edits as a blank box. */
export function forecastText(value: number | null | undefined): string {
  return value ? String(value) : "";
}

export function whole(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error("Use whole numbers.");
  return Math.round(value);
}

/** GraphQL input fields for plan / update. Hidden fields go out blank so the API clears them. */
export function planInput(form: PlanFormState): Record<string, unknown> {
  const { activity } = form;
  const staffed = isStaffedActivity(activity);
  const withSupport = staffed && form.needsFieldSupport;
  const showSkus = staffed || activity === "product_seeding";
  return {
    market: form.market,
    activity,
    name: form.name.trim(),
    startsOn: form.startsOn,
    days: showsDays(activity) ? whole(form.days || "1") : 1,
    address: form.address.trim(),
    notes: form.notes.trim(),
    plannedFullCans: showsCans(activity) ? whole(form.plannedFullCans) : 0,
    plannedPourSamples: showsPours(activity) ? whole(form.plannedPourSamples) : 0,
    plannedEmails: whole(form.plannedEmails),
    setupDay: showsDays(activity) && form.setupDay,
    samplingFormat: staffed ? form.samplingFormat : "",
    supportType: activity === "sales_support" ? form.supportType : "",
    supportOther:
      activity === "sales_support" && form.supportType === "other"
        ? form.supportOther.trim()
        : "",
    skuNames: showSkus ? form.skuNames : [],
    needsFieldSupport: withSupport,
    ambassadorCount: withSupport ? whole(form.ambassadorCount || "0") : 0,
    startTime: staffed ? form.startTime : "",
    endTime: staffed && form.startTime ? form.endTime : "",
    supportTimes: staffed && !form.startTime ? form.supportTimes.trim() : "",
    supportScope: withSupport ? form.supportScope.trim() : "",
  };
}
