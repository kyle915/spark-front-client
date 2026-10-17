/**
 * On-device draft for the public spark-form (`/spark-form/:tenantSlug`).
 *
 * A requestor who gets interrupted — a text, a lost tab, a manager asking
 * for the store number — used to start over from a blank form. The draft
 * autosaves to localStorage keyed by tenant slug, offers Resume / Discard
 * on return, and is cleared by a successful submit. It is never sent to
 * the server: it cannot file, approve, or email anything on its own.
 */

import type { VisitSlot } from "./eventActivationSchedule";
import type { CoBrandSelection } from "./components/coBrandPayload";

export type PublicFormDraft = {
  v: 1;
  slug: string;
  savedAt: number;
  venue: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  storeQ: string;
  pickedStore: { id: string; address: string } | null;
  date: string;
  extraDates: string[];
  visitSlots: VisitSlot[];
  startTime: string;
  endTime: string;
  timezoneId: string;
  requestTypeId: string;
  productIds: string[];
  productNameById: Record<string, string>;
  selectedProductTypeId: string | null;
  requestorEmail: string;
  requestorName: string;
  storeContact: string;
  storeManagerName: string;
  storeManagerPhone: string;
  baCount: number;
  distributorQ: string;
  distributorId: string;
  distributorName: string;
  notes: string;
  schedulingStatus: string;
  nonActiveProductRequired: string;
  casesToBeShipped: string;
  accountSpendAmount: string;
  eventAssetsNeeded: string;
  loadInTime: string;
  onsitePoc: string;
  additionalTeamDetails: string;
  multiBrand: boolean | null;
  coBrandSelection: CoBrandSelection;
};

export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const memory = new Map<string, string>();
const memoryStorage: DraftStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

export function liveDraftStorage(): DraftStorage {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* Safari private mode throws on even reading localStorage */
  }
  return memoryStorage;
}

export const publicFormDraftKey = (slug: string) =>
  `@spark.public-form.draft/${encodeURIComponent(slug.trim())}`;

const STRING_FIELDS = [
  "venue",
  "address",
  "storeQ",
  "date",
  // startTime / endTime always carry defaults ("12:00" / "16:00"), so they
  // can never be what makes a draft worth resuming on their own.
  "timezoneId",
  "requestTypeId",
  "requestorEmail",
  "requestorName",
  "storeContact",
  "storeManagerName",
  "storeManagerPhone",
  "distributorQ",
  "distributorId",
  "distributorName",
  "notes",
  "schedulingStatus",
  "nonActiveProductRequired",
  "casesToBeShipped",
  "accountSpendAmount",
  "eventAssetsNeeded",
  "loadInTime",
  "onsitePoc",
  "additionalTeamDetails",
] as const;

/** True when the draft holds anything worth offering to resume. */
export function hasPublicFormDraftContent(
  draft: Omit<PublicFormDraft, "v" | "slug" | "savedAt">,
): boolean {
  if (STRING_FIELDS.some((field) => draft[field].trim() !== "")) return true;
  if (draft.productIds.length > 0 || draft.extraDates.length > 0) return true;
  if (draft.visitSlots.some((slot) => slot.date.trim() !== "")) return true;
  if (draft.latitude != null || draft.longitude != null || draft.pickedStore) return true;
  if (draft.baCount !== 1 || draft.multiBrand != null) return true;
  return Object.keys(draft.coBrandSelection).length > 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function visitSlots(value: unknown): VisitSlot[] {
  if (!Array.isArray(value)) return [{ date: "", startTime: "12:00", endTime: "16:00" }];
  const slots = value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      date: typeof v.date === "string" ? v.date : "",
      startTime: typeof v.startTime === "string" ? v.startTime : "12:00",
      endTime: typeof v.endTime === "string" ? v.endTime : "16:00",
    }));
  return slots.length > 0 ? slots : [{ date: "", startTime: "12:00", endTime: "16:00" }];
}

export function readPublicFormDraft(
  slug: string,
  storage: DraftStorage = liveDraftStorage(),
): PublicFormDraft | null {
  if (!slug.trim()) return null;
  try {
    const raw = storage.getItem(publicFormDraftKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicFormDraft>;
    if (!parsed || parsed.v !== 1 || parsed.slug !== slug) return null;
    const draft: PublicFormDraft = {
      v: 1,
      slug,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
      venue: parsed.venue ?? "",
      address: parsed.address ?? "",
      latitude: typeof parsed.latitude === "number" ? parsed.latitude : null,
      longitude: typeof parsed.longitude === "number" ? parsed.longitude : null,
      storeQ: parsed.storeQ ?? "",
      pickedStore:
        parsed.pickedStore && typeof parsed.pickedStore.id === "string"
          ? { id: parsed.pickedStore.id, address: parsed.pickedStore.address ?? "" }
          : null,
      date: parsed.date ?? "",
      extraDates: stringArray(parsed.extraDates),
      visitSlots: visitSlots(parsed.visitSlots),
      startTime: parsed.startTime ?? "12:00",
      endTime: parsed.endTime ?? "16:00",
      timezoneId: parsed.timezoneId ?? "",
      requestTypeId: parsed.requestTypeId ?? "",
      productIds: stringArray(parsed.productIds),
      productNameById:
        parsed.productNameById && typeof parsed.productNameById === "object"
          ? parsed.productNameById
          : {},
      selectedProductTypeId:
        typeof parsed.selectedProductTypeId === "string" ? parsed.selectedProductTypeId : null,
      requestorEmail: parsed.requestorEmail ?? "",
      requestorName: parsed.requestorName ?? "",
      storeContact: parsed.storeContact ?? "",
      storeManagerName: parsed.storeManagerName ?? "",
      storeManagerPhone: parsed.storeManagerPhone ?? "",
      baCount:
        typeof parsed.baCount === "number" && Number.isFinite(parsed.baCount)
          ? parsed.baCount
          : 1,
      distributorQ: parsed.distributorQ ?? "",
      distributorId: parsed.distributorId ?? "",
      distributorName: parsed.distributorName ?? "",
      notes: parsed.notes ?? "",
      schedulingStatus: parsed.schedulingStatus ?? "",
      nonActiveProductRequired: parsed.nonActiveProductRequired ?? "",
      casesToBeShipped: parsed.casesToBeShipped ?? "",
      accountSpendAmount: parsed.accountSpendAmount ?? "",
      eventAssetsNeeded: parsed.eventAssetsNeeded ?? "",
      loadInTime: parsed.loadInTime ?? "",
      onsitePoc: parsed.onsitePoc ?? "",
      additionalTeamDetails: parsed.additionalTeamDetails ?? "",
      multiBrand: typeof parsed.multiBrand === "boolean" ? parsed.multiBrand : null,
      coBrandSelection:
        parsed.coBrandSelection && typeof parsed.coBrandSelection === "object"
          ? parsed.coBrandSelection
          : {},
    };
    return hasPublicFormDraftContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function writePublicFormDraft(
  slug: string,
  draft: Omit<PublicFormDraft, "v" | "slug" | "savedAt">,
  storage: DraftStorage = liveDraftStorage(),
  nowMs: number = Date.now(),
): void {
  if (!slug.trim()) return;
  try {
    const full: PublicFormDraft = { v: 1, slug, savedAt: nowMs, ...draft };
    storage.setItem(publicFormDraftKey(slug), JSON.stringify(full));
  } catch {
    /* private mode / quota — the draft is a convenience, never required */
  }
}

export function clearPublicFormDraft(
  slug: string,
  storage: DraftStorage = liveDraftStorage(),
): void {
  if (!slug.trim()) return;
  try {
    storage.removeItem(publicFormDraftKey(slug));
  } catch {
    /* disposable */
  }
}
