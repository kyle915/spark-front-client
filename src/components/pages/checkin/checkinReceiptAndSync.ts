import type { StorageLike } from "./offlineClock";
import { liveStorage } from "./offlineRecap";

export type CheckinSyncTone = "synced" | "draft" | "offline" | "attention";

export interface CheckinSyncPillState {
  visible: boolean;
  tone: CheckinSyncTone;
  label: string;
}

export function deriveCheckinSyncPill(opts: {
  identified: boolean;
  isOnline: boolean;
  syncingNow: boolean;
  hasQueuedWork: boolean;
  hasRejectedWork: boolean;
  hasLocalDraft: boolean;
  clockState: "not_started" | "clocked_in" | "clocked_out";
  hasRecap: boolean;
}): CheckinSyncPillState {
  if (opts.hasRejectedWork) {
    return {
      visible: true,
      tone: "attention",
      label: "Action needed · Saved on phone",
    };
  }
  if (opts.hasQueuedWork || (opts.identified && !opts.isOnline)) {
    return {
      visible: true,
      tone: "offline",
      label: opts.syncingNow
        ? "Syncing saved work…"
        : "Offline queue — safe to close",
    };
  }
  if (opts.identified && opts.hasLocalDraft && !opts.hasRecap) {
    return {
      visible: true,
      tone: "draft",
      label: "Saved on phone · Draft ready",
    };
  }
  if (opts.identified && (opts.clockState !== "not_started" || opts.hasRecap)) {
    return {
      visible: true,
      tone: "synced",
      label: "Saved on phone · Synced",
    };
  }
  return {
    visible: false,
    tone: "synced",
    label: "",
  };
}

export interface ShiftReceiptSnapshot {
  samplesCount: number | null;
  photosCount: number;
  filedAt: string;
}

const receiptTokenTail = (token: string) => token.slice(-24);

export const shiftReceiptStorageKey = (code: string, token: string): string =>
  `@spark.checkin.receipt/${code}/${receiptTokenTail(token)}`;

export function computeRecapSamplesCount(opts: {
  productSamples?: ReadonlyArray<{ quantity: number }> | null;
  totalEngagements?: number | null;
}): number | null {
  let skuSum = 0;
  for (const row of opts.productSamples ?? []) {
    if (row && Number.isFinite(row.quantity) && row.quantity > 0) {
      skuSum += row.quantity;
    }
  }
  if (skuSum > 0) return skuSum;
  if (
    typeof opts.totalEngagements === "number" &&
    Number.isFinite(opts.totalEngagements) &&
    opts.totalEngagements > 0
  ) {
    return opts.totalEngagements;
  }
  return null;
}

export function writeShiftReceiptSnapshot(
  code: string,
  token: string,
  snapshot: ShiftReceiptSnapshot,
  storage: StorageLike = liveStorage(),
): void {
  if (!code || !token) return;
  try {
    storage.setItem(
      shiftReceiptStorageKey(code, token),
      JSON.stringify(snapshot),
    );
  } catch {
    /* private mode or storage quota */
  }
}

export function readShiftReceiptSnapshot(
  code: string,
  token: string,
  storage: StorageLike = liveStorage(),
): ShiftReceiptSnapshot | null {
  if (!code || !token) return null;
  try {
    const raw = storage.getItem(shiftReceiptStorageKey(code, token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ShiftReceiptSnapshot>;
    if (!parsed || typeof parsed !== "object") return null;
    const photosCount =
      typeof parsed.photosCount === "number" &&
      Number.isFinite(parsed.photosCount) &&
      parsed.photosCount >= 0
        ? parsed.photosCount
        : 0;
    const samplesCount =
      typeof parsed.samplesCount === "number" &&
      Number.isFinite(parsed.samplesCount) &&
      parsed.samplesCount >= 0
        ? parsed.samplesCount
        : null;
    return {
      samplesCount,
      photosCount,
      filedAt: typeof parsed.filedAt === "string" ? parsed.filedAt : "",
    };
  } catch {
    return null;
  }
}

export function clearShiftReceiptSnapshot(
  code: string,
  token: string,
  storage: StorageLike = liveStorage(),
): void {
  if (!code || !token) return;
  try {
    storage.removeItem(shiftReceiptStorageKey(code, token));
  } catch {
    /* disposable */
  }
}

export interface ShiftReceiptMetrics {
  hoursLabel: string;
  samplesLabel: string;
  photosLabel: string;
  showSamplesAndPhotos: boolean;
  statusBadge: string;
}

export function buildShiftReceiptMetrics(opts: {
  workedHoursValue: number | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  recapOnly?: boolean;
  timesheetOnly?: boolean;
  snapshot: ShiftReceiptSnapshot | null;
  pendingRecapFilesCount?: number | null;
  pendingRecapSamplesCount?: number | null;
  isQueuedOffline?: boolean;
}): ShiftReceiptMetrics {
  let hoursLabel = "—";
  if (opts.workedHoursValue != null && Number.isFinite(opts.workedHoursValue)) {
    hoursLabel = `${opts.workedHoursValue} ${
      opts.workedHoursValue === 1 ? "hr" : "hrs"
    }`;
  } else if (opts.recapOnly) {
    hoursLabel = "Recap only";
  } else if (opts.clockInAt && !opts.clockOutAt) {
    hoursLabel = "On clock";
  }

  const samplesCount =
    opts.snapshot?.samplesCount ?? opts.pendingRecapSamplesCount ?? null;
  const photosCount =
    opts.snapshot?.photosCount ?? opts.pendingRecapFilesCount ?? null;

  return {
    hoursLabel,
    samplesLabel:
      samplesCount != null ? samplesCount.toLocaleString("en-US") : "Filed",
    photosLabel:
      photosCount != null ? photosCount.toLocaleString("en-US") : "Filed",
    showSamplesAndPhotos: !opts.timesheetOnly,
    statusBadge: opts.isQueuedOffline
      ? "Queued offline · Safe to close"
      : "Synced",
  };
}
