/**
 * Unified Relay store + cross-tab synchronization for recap approvals.
 *
 * Ensures approving or un-approving a recap from ANY surface (detail view,
 * Quick Peek, bulk approve, Approvals queue, or a second browser tab)
 * immediately updates:
 * 1. Every matching `Recap` / `CustomRecap` node in Relay's normalized store
 *    (even for `bulkApproveRecaps`, which returns counts instead of nodes).
 * 2. Prefetched detail subscriptions (`prefetchRecapDetail`), so opening a
 *    newly approved recap never paints a stale `approved: false` snapshot.
 * 3. Same-tab and cross-tab listeners (`SparkRecapsList`, `SparkClientApprovals`,
 *    `RecapCustomView`, `SparkRecapView`, `SparkEventView`) so open lists and
 *    tabs refresh automatically without a manual browser reload.
 */

import type { RecordSourceSelectorProxy } from "relay-runtime";
import { markRecapsListNeedsRefresh } from "./recapListFilters";

export const RECAP_APPROVAL_EVENT = "spark:recap-approval-changed";
export const RECAP_APPROVAL_STORAGE_KEY = "spark.recaps.approvalChangedAt";

type PrefetchInvalidator = (uuids?: readonly string[]) => void;
const prefetchInvalidators = new Set<PrefetchInvalidator>();

/** Register a prefetch-cache invalidator without pulling Relay query artifacts into unit tests. */
export function registerPrefetchInvalidator(fn: PrefetchInvalidator): () => void {
  prefetchInvalidators.add(fn);
  return () => {
    prefetchInvalidators.delete(fn);
  };
}

export interface RecapApprovalChangedDetail {
  ids: string[];
  uuids: string[];
  approved: boolean;
  at: number;
  source?: string;
}

/**
 * Mutate normalized Relay `Recap` / `CustomRecap` store records in-place so
 * every mounted badge, card, Quick Peek sheet, and detail view reflects the
 * new approval state immediately (zero flash back to "Needs review").
 */
export function applyRecapApprovalToStore(
  store: Pick<RecordSourceSelectorProxy, "get">,
  ids: readonly string[],
  approved: boolean,
  approvedAt?: string | null,
): void {
  const stamp = approved ? (approvedAt ?? new Date().toISOString()) : null;
  for (const id of ids) {
    if (!id) continue;
    const record = store.get(id);
    if (!record) continue;
    record.setValue(approved, "approved");
    record.setValue(stamp, "approvedAt");
    if (approved) {
      // Backend clears archive park whenever a recap is approved.
      record.setValue(null, "archivedAt");
    }
  }
}

/**
 * Broadcast an approval state change across the current tab AND any other open
 * Spark tabs, while invalidating prefetched detail entries and marking lists
 * dirty for remounts.
 */
export function notifyRecapApprovalChanged(input: {
  ids?: readonly string[];
  uuids?: readonly string[];
  approved: boolean;
  source?: string;
}): RecapApprovalChangedDetail {
  const detail: RecapApprovalChangedDetail = {
    ids: Array.from(new Set((input.ids ?? []).filter(Boolean))),
    uuids: Array.from(new Set((input.uuids ?? []).filter(Boolean))),
    approved: Boolean(input.approved),
    at: Date.now(),
    ...(input.source ? { source: input.source } : {}),
  };

  markRecapsListNeedsRefresh();
  for (const invalidate of prefetchInvalidators) {
    try {
      invalidate(detail.uuids);
    } catch {
      // ignore invalidator failure
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<RecapApprovalChangedDetail>(RECAP_APPROVAL_EVENT, {
          detail,
        }),
      );
    } catch {
      // ignore CustomEvent errors in non-browser environments
    }
    try {
      window.localStorage.setItem(
        RECAP_APPROVAL_STORAGE_KEY,
        JSON.stringify(detail),
      );
    } catch {
      // private mode / quota — same-tab event + session flag still fire
    }
  }

  return detail;
}

/**
 * Subscribe a mounted page to recap approval changes originating in the same
 * tab (e.g. Quick Peek / bulk approve) or another tab (e.g. recap opened via
 * ⌘+click / Open in new tab and approved there).
 */
export function subscribeRecapApprovalChanged(
  onChanged: (detail?: RecapApprovalChangedDetail) => void,
  opts?: { matchUuid?: string | null; ignoreSource?: string },
): () => void {
  if (typeof window === "undefined") return () => {};

  const targetUuid = opts?.matchUuid?.trim() || null;
  const ignoreSource = opts?.ignoreSource || null;
  let lastSeenAt = Date.now();

  const shouldNotify = (
    detail?: RecapApprovalChangedDetail | null,
    isSameTab = false,
  ): boolean => {
    if (!detail) return true;
    if (detail.at <= lastSeenAt) return false;
    lastSeenAt = detail.at;
    if (isSameTab && ignoreSource && detail.source === ignoreSource) {
      return false;
    }
    if (
      targetUuid &&
      detail.uuids.length > 0 &&
      !detail.uuids.includes(targetUuid)
    ) {
      return false;
    }
    return true;
  };

  const handleCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<RecapApprovalChangedDetail>).detail;
    if (shouldNotify(detail, true)) onChanged(detail);
  };

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key !== RECAP_APPROVAL_STORAGE_KEY || !ev.newValue) return;
    try {
      const parsed = JSON.parse(ev.newValue) as RecapApprovalChangedDetail;
      if (shouldNotify(parsed)) onChanged(parsed);
    } catch {
      onChanged();
    }
  };

  const checkStoredOnFocus = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(RECAP_APPROVAL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecapApprovalChangedDetail;
      if (shouldNotify(parsed)) onChanged(parsed);
    } catch {
      // ignore
    }
  };

  window.addEventListener(RECAP_APPROVAL_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", checkStoredOnFocus);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", checkStoredOnFocus);
  }

  return () => {
    window.removeEventListener(RECAP_APPROVAL_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", checkStoredOnFocus);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", checkStoredOnFocus);
    }
  };
}
