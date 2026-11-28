/**
 * Unified Relay store + cross-tab synchronization for activation request
 * approvals and declines.
 *
 * Ensures approving or declining a request from ANY surface (Approvals queue,
 * Master Tracker inline/bulk approve, Client Approvals tab, Request Detail,
 * Recent Submissions, or a second browser tab) immediately updates:
 * 1. Every matching normalized `Request` node in Relay's store — using a
 *    dedicated client-local status record so the shared `pending`
 *    `RequestStatusNode` is NEVER mutated in place.
 * 2. Same-tab and cross-tab listeners so mounted queues, tracker counts,
 *    and detail pages refresh automatically without a manual reload.
 */

import type { RecordSourceSelectorProxy } from "relay-runtime";

export type RequestDecision = "approved" | "declined";

export const REQUEST_APPROVAL_EVENT = "spark:request-approval-changed";
export const REQUEST_APPROVAL_STORAGE_KEY = "spark.requests.approvalChangedAt";

export interface RequestApprovalChangedDetail {
  ids: string[];
  uuids: string[];
  decision: RequestDecision;
  at: number;
  source?: string;
}

const DECISION_LABELS: Record<RequestDecision, string> = {
  approved: "Approved",
  declined: "Declined",
};

/**
 * Update normalized Relay `Request` records in-place to reflect an immediate
 * approval or decline before the follow-up network refresh lands.
 *
 * IMPORTANT: `Request.status` points to a shared `RequestStatusNode` keyed by
 * global ID, so we create/reuse a synthetic client-local status record
 * (`client:request-status:<decision>`) and link ONLY the decided requests to
 * it — leaving every other pending request's status untouched.
 */
export function applyRequestDecisionToStore(
  store: Pick<RecordSourceSelectorProxy, "get" | "create">,
  ids: readonly string[],
  decision: RequestDecision,
  opts?: { declineReason?: string | null; updatedAt?: string | null },
): void {
  const validIds = ids.filter(Boolean);
  if (validIds.length === 0) return;

  const statusRecordId = `client:request-status:${decision}`;
  const statusRecord =
    store.get(statusRecordId) ??
    store.create(statusRecordId, "RequestStatusNode");
  statusRecord.setValue(decision, "slug");
  statusRecord.setValue(DECISION_LABELS[decision], "name");

  const stamp = opts?.updatedAt ?? new Date().toISOString();
  const reason =
    decision === "declined" && opts?.declineReason?.trim()
      ? opts.declineReason.trim()
      : null;

  for (const id of validIds) {
    const record = store.get(id);
    if (!record) continue;
    record.setLinkedRecord(statusRecord, "status");
    record.setValue(stamp, "updatedAt");
    if (reason) {
      record.setValue(reason, "declineReason");
    }
  }
}

/**
 * Broadcast a request approval/decline across the current tab AND any other
 * open Spark tabs.
 */
export function notifyRequestApprovalChanged(input: {
  ids?: readonly string[];
  uuids?: readonly string[];
  decision: RequestDecision;
  source?: string;
}): RequestApprovalChangedDetail {
  const detail: RequestApprovalChangedDetail = {
    ids: Array.from(new Set((input.ids ?? []).filter(Boolean))),
    uuids: Array.from(new Set((input.uuids ?? []).filter(Boolean))),
    decision: input.decision,
    at: Date.now(),
    ...(input.source ? { source: input.source } : {}),
  };

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<RequestApprovalChangedDetail>(REQUEST_APPROVAL_EVENT, {
          detail,
        }),
      );
    } catch {
      // ignore CustomEvent errors in non-browser environments
    }
    try {
      window.localStorage.setItem(
        REQUEST_APPROVAL_STORAGE_KEY,
        JSON.stringify(detail),
      );
    } catch {
      // private mode / quota — same-tab event still fires
    }
  }

  return detail;
}

/**
 * Subscribe a mounted page to request approval/decline events originating in
 * the same tab or another open Spark tab.
 */
export function subscribeRequestApprovalChanged(
  onChanged: (detail?: RequestApprovalChangedDetail) => void,
  opts?: { matchUuid?: string | null; ignoreSource?: string },
): () => void {
  if (typeof window === "undefined") return () => {};

  const targetUuid = opts?.matchUuid?.trim() || null;
  const ignoreSource = opts?.ignoreSource || null;
  let lastSeenAt = Date.now();

  const shouldNotify = (
    detail?: RequestApprovalChangedDetail | null,
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
    const detail = (ev as CustomEvent<RequestApprovalChangedDetail>).detail;
    if (shouldNotify(detail, true)) onChanged(detail);
  };

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key !== REQUEST_APPROVAL_STORAGE_KEY || !ev.newValue) return;
    try {
      const parsed = JSON.parse(ev.newValue) as RequestApprovalChangedDetail;
      if (shouldNotify(parsed)) onChanged(parsed);
    } catch {
      onChanged();
    }
  };

  const checkStoredOnFocus = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(REQUEST_APPROVAL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RequestApprovalChangedDetail;
      if (shouldNotify(parsed)) onChanged(parsed);
    } catch {
      // ignore
    }
  };

  window.addEventListener(REQUEST_APPROVAL_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", checkStoredOnFocus);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", checkStoredOnFocus);
  }

  return () => {
    window.removeEventListener(REQUEST_APPROVAL_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", checkStoredOnFocus);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", checkStoredOnFocus);
    }
  };
}
