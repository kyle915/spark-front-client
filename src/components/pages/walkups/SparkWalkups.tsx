import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { WalkupShiftsQuery } from "@/api/queries/WalkupShiftsQuery";
import type { WalkupShiftsQuery as WalkupShiftsQueryType } from "@api/queries/__generated__/WalkupShiftsQuery.graphql";
import {
  ConfirmWalkupShiftMutation,
  RejectWalkupShiftMutation,
  BulkConfirmWalkupShiftsMutation,
  BulkRejectWalkupShiftsMutation,
} from "@/api/mutations/WalkupMutations";
import type { WalkupMutationsConfirmMutation as ConfirmType } from "@api/mutations/__generated__/WalkupMutationsConfirmMutation.graphql";
import type { WalkupMutationsRejectMutation as RejectType } from "@api/mutations/__generated__/WalkupMutationsRejectMutation.graphql";
import type { WalkupMutationsBulkConfirmMutation as BulkConfirmType } from "@api/mutations/__generated__/WalkupMutationsBulkConfirmMutation.graphql";
import type { WalkupMutationsBulkRejectMutation as BulkRejectType } from "@api/mutations/__generated__/WalkupMutationsBulkRejectMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Walk-ups queue — tenant-wide review of self-serve clock-ins created from an
 * event code (no prior assignment). Ops confirm (approve → hours count +
 * activate a new BA) or reject (remove the booking). Modeled on the other
 * Workspace review queues (Receipts / Approvals).
 */
type Filter = "pending" | "all";
type Row = WalkupShiftsQueryType["response"]["walkupShifts"][number];

const fmt = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const Inner: React.FC<{ filter: Filter; refreshKey: number; bump: () => void }> = ({
  filter,
  refreshKey,
  bump,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<WalkupShiftsQueryType>(
    WalkupShiftsQuery,
    { status: filter === "pending" ? "pending" : null },
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );
  const rows: Row[] = (data?.walkupShifts ?? []).filter(Boolean) as Row[];

  const [commitConfirm, confirming] = useMutation<ConfirmType>(
    ConfirmWalkupShiftMutation,
  );
  const [commitReject, rejecting] = useMutation<RejectType>(
    RejectWalkupShiftMutation,
  );
  const [commitBulkConfirm, bulkConfirming] = useMutation<BulkConfirmType>(
    BulkConfirmWalkupShiftsMutation,
  );
  const [commitBulkReject, bulkRejecting] = useMutation<BulkRejectType>(
    BulkRejectWalkupShiftsMutation,
  );
  const busy = confirming || rejecting || bulkConfirming || bulkRejecting;

  // Bulk triage: select pending walk-ups and confirm/reject them in one go.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pendingUuids = rows
    .filter((r) => !r.isApproved)
    .map((r) => r.ambassadorEventUuid);
  const toggleSel = (uuid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
      return next;
    });
  const allSelected =
    pendingUuids.length > 0 && pendingUuids.every((u) => selected.has(u));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pendingUuids));
  const selectedList = pendingUuids.filter((u) => selected.has(u));

  const runBulk = (kind: "confirm" | "reject") => {
    if (selectedList.length === 0) return;
    if (
      kind === "reject" &&
      !window.confirm(
        `Reject ${selectedList.length} walk-up${selectedList.length === 1 ? "" : "s"}? This removes their clock-ins.`,
      )
    )
      return;
    const commit = kind === "confirm" ? commitBulkConfirm : commitBulkReject;
    commit({
      variables: { input: { ambassadorEventUuids: selectedList } },
      onCompleted: (resp: BulkConfirmType["response"] | BulkRejectType["response"]) => {
        const r =
          "bulkConfirmWalkupShifts" in resp
            ? resp.bulkConfirmWalkupShifts
            : resp.bulkRejectWalkupShifts;
        showAlert(r?.message || "Done.", r?.success ? "success" : "error");
        setSelected(new Set());
        if (r?.success) bump();
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const onConfirm = (r: Row) => {
    commitConfirm({
      variables: { input: { ambassadorEventUuid: r.ambassadorEventUuid } },
      onCompleted: (resp) => {
        const ok = resp.confirmWalkupShift?.success;
        showAlert(
          resp.confirmWalkupShift?.message ||
            (ok ? "Confirmed." : "Couldn't confirm."),
          ok ? "success" : "error",
        );
        if (ok) bump();
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const onReject = (r: Row) => {
    if (
      !window.confirm(
        `Reject ${r.ambassadorName}'s walk-up for ${r.eventName}? This removes the clock-in.`,
      )
    )
      return;
    commitReject({
      variables: { input: { ambassadorEventUuid: r.ambassadorEventUuid } },
      onCompleted: (resp) => {
        const ok = resp.rejectWalkupShift?.success;
        showAlert(
          resp.rejectWalkupShift?.message ||
            (ok ? "Rejected." : "Couldn't reject."),
          ok ? "success" : "error",
        );
        if (ok) bump();
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  if (rows.length === 0) {
    return (
      <p
        className="p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {filter === "pending"
          ? "No walk-ups waiting on review. 🎉"
          : "No walk-ups yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pendingUuids.length > 0 && (
        <div
          className="flex items-center justify-between gap-3 flex-wrap spark-card p-3"
          style={{ borderRadius: 14 }}
        >
          <button
            onClick={toggleAll}
            className="text-sm font-semibold"
            style={{ color: "var(--spark-text)" }}
          >
            {allSelected ? "☑ Deselect all" : "☐ Select all pending"}
            <span style={{ color: "rgba(255,255,255,0.45)" }}>
              {" "}
              ({pendingUuids.length})
            </span>
          </button>
          {selectedList.length > 0 && (
            <div className="flex items-center gap-2">
              <span
                className="mono text-[11px]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {selectedList.length} selected
              </span>
              <button
                onClick={() => runBulk("reject")}
                disabled={busy}
                className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "transparent",
                  color: "var(--spark-orange)",
                  border: "1px solid rgba(239,90,42,0.35)",
                }}
              >
                Reject {selectedList.length}
              </button>
              <button
                onClick={() => runBulk("confirm")}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
              >
                Confirm {selectedList.length}
              </button>
            </div>
          )}
        </div>
      )}
      {rows.map((r) => (
        <div
          key={r.ambassadorEventUuid}
          className="spark-card p-4"
          style={{ borderRadius: 16 }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold">
                  {r.ambassadorName || "(unnamed)"}
                </span>
                {r.isNewAccount && (
                  <span
                    className="mono text-[9px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-gold)",
                      background: "rgba(255,196,0,0.12)",
                      border: "1px solid rgba(255,196,0,0.3)",
                      padding: "1px 6px",
                      borderRadius: 999,
                    }}
                  >
                    NEW ACCOUNT
                  </span>
                )}
                {r.isApproved ? (
                  <span
                    className="mono text-[9px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-lime)",
                      background: "rgba(197,245,70,0.1)",
                      border: "1px solid rgba(197,245,70,0.3)",
                      padding: "1px 6px",
                      borderRadius: 999,
                    }}
                  >
                    ✓ CONFIRMED
                  </span>
                ) : (
                  <span
                    className="mono text-[9px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-orange)",
                      background: "rgba(239,90,42,0.12)",
                      border: "1px solid rgba(239,90,42,0.35)",
                      padding: "1px 6px",
                      borderRadius: 999,
                    }}
                  >
                    ⏳ PENDING
                  </span>
                )}
              </div>
              <p
                className="mono text-[11px] mt-1"
                style={{ letterSpacing: "0.06em", color: "rgba(255,255,255,0.5)" }}
              >
                {r.brandName} · {r.eventName}
              </p>
              {r.ambassadorEmail ? (
                <p
                  className="mono text-[10px] mt-0.5"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {r.ambassadorEmail}
                  {r.ambassadorPhone ? ` · ${r.ambassadorPhone}` : ""}
                </p>
              ) : null}
              <div
                className="flex items-center gap-3 mt-2 flex-wrap mono text-[10px]"
                style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em" }}
              >
                <span>IN {fmt(r.clockInAt)}</span>
                <span>OUT {fmt(r.clockOutAt)}</span>
                {r.distanceFromVenueMi != null && (
                  <span
                    style={{
                      color:
                        r.distanceFromVenueMi > 0.5
                          ? "var(--spark-orange)"
                          : "var(--spark-lime)",
                    }}
                  >
                    {r.distanceFromVenueMi.toFixed(2)} mi from venue
                  </span>
                )}
                <span>{r.hasRecap ? "✓ recap filed" : "no recap"}</span>
              </div>
            </div>
            {!r.isApproved && (
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="checkbox"
                  checked={selected.has(r.ambassadorEventUuid)}
                  onChange={() => toggleSel(r.ambassadorEventUuid)}
                  aria-label={`Select ${r.ambassadorName}'s walk-up`}
                  style={{ width: 18, height: 18, accentColor: "var(--spark-lime)", cursor: "pointer" }}
                />
                <button
                  onClick={() => onReject(r)}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{
                    background: "transparent",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => onConfirm(r)}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function SparkWalkups() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <p
        className="mono text-[10px] mb-1"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        WORKSPACE
      </p>
      <h1 className="display text-2xl font-bold mb-1">Walk-ups</h1>
      <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>
        Self-serve clock-ins from an event code. Confirm to count their hours
        (and activate a new BA), or reject.
      </p>

      <div className="flex items-center gap-1 mb-5">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-full text-sm font-semibold"
            style={{
              background: filter === f ? "var(--spark-lime)" : "transparent",
              color: filter === f ? "#0a0d09" : "var(--spark-text)",
              border:
                filter === f ? "none" : "1px solid var(--spark-border)",
            }}
          >
            {f === "pending" ? "Needs review" : "All"}
          </button>
        ))}
      </div>

      <Suspense
        fallback={
          <p
            className="p-8 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading walk-ups…
          </p>
        }
      >
        <Inner filter={filter} refreshKey={refreshKey} bump={bump} />
      </Suspense>
    </div>
  );
}
