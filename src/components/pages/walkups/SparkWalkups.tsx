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
import SparkConfirm from "@/shared/SparkConfirm";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SidebarTabCount from "@/shared/SidebarTabCount";
import StandingCheckinLink from "./StandingCheckinLink";
import CheckinIssuesCard from "./CheckinIssuesCard";
import ClockLinks from "./ClockLinks";

/**
 * Walk-ups queue — tenant-wide review of self-serve clock-ins created from an
 * event code (no prior assignment). Ops confirm (approve → hours count +
 * activate a new BA) or reject (remove the booking). Modeled on the other
 * Workspace review queues (Receipts / Approvals).
 */
type Filter = "pending" | "all";
type WalkupsTab = "codes" | "queue" | "clock";
type Row = WalkupShiftsQueryType["response"]["walkupShifts"][number];
type RejectPrompt = { kind: "bulk" } | { kind: "one"; row: Row };

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
  const [rejectPrompt, setRejectPrompt] = useState<RejectPrompt | null>(null);

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
    if (kind === "reject") {
      setRejectPrompt({ kind: "bulk" });
      return;
    }
    commitBulkConfirm({
      variables: { input: { ambassadorEventUuids: selectedList } },
      onCompleted: (resp) => {
        const r = resp.bulkConfirmWalkupShifts;
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
    setRejectPrompt({ kind: "one", row: r });
  };

  const confirmReject = () => {
    if (!rejectPrompt || busy) return;
    if (rejectPrompt.kind === "bulk") {
      commitBulkReject({
        variables: { input: { ambassadorEventUuids: selectedList } },
        onCompleted: (resp) => {
          const r = resp.bulkRejectWalkupShifts;
          showAlert(r?.message || "Done.", r?.success ? "success" : "error");
          setSelected(new Set());
          setRejectPrompt(null);
          if (r?.success) bump();
        },
        onError: (e) => showAlert(e.message, "error"),
      });
      return;
    }
    const row = rejectPrompt.row;
    commitReject({
      variables: { input: { ambassadorEventUuid: row.ambassadorEventUuid } },
      onCompleted: (resp) => {
        const ok = resp.rejectWalkupShift?.success;
        showAlert(
          resp.rejectWalkupShift?.message ||
            (ok ? "Rejected." : "Couldn't reject."),
          ok ? "success" : "error",
        );
        setRejectPrompt(null);
        if (ok) bump();
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  if (rows.length === 0) {
    return (
      <p
        className="p-8 text-center text-sm"
        style={{ color: "var(--spark-text-meta)" }}
      >
        {filter === "pending"
          ? "No walk-ups waiting on review."
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
            <span style={{ color: "var(--spark-text-meta)" }}>
              {" "}
              ({pendingUuids.length})
            </span>
          </button>
          {selectedList.length > 0 && (
            <div className="flex items-center gap-2">
              <span
                className="mono text-[11px]"
                style={{ color: "var(--spark-text-meta)" }}
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
                style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
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
                      background: "rgba(var(--spark-accent-rgb),0.1)",
                      border: "1px solid rgba(var(--spark-accent-rgb),0.3)",
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
                style={{ letterSpacing: "0.06em", color: "var(--spark-text-meta)" }}
              >
                {r.brandName} · {r.eventName}
              </p>
              {r.ambassadorEmail ? (
                <p
                  className="mono text-[10px] mt-0.5"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {r.ambassadorEmail}
                  {r.ambassadorPhone ? ` · ${r.ambassadorPhone}` : ""}
                </p>
              ) : null}
              <div
                className="flex items-center gap-3 mt-2 flex-wrap mono text-[10px]"
                style={{ color: "var(--spark-text-meta)", letterSpacing: "0.06em" }}
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
                  style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {rejectPrompt ? (
        <SparkConfirm
          tone="danger"
          kicker="Reject"
          title={
            rejectPrompt.kind === "bulk"
              ? `Reject ${selectedList.length} walk-up${selectedList.length === 1 ? "" : "s"}`
              : `Reject ${rejectPrompt.row.ambassadorName}`
          }
          body={
            rejectPrompt.kind === "bulk"
              ? "This removes their clock-ins."
              : `This removes the clock-in for ${rejectPrompt.row.eventName}.`
          }
          confirmLabel="Reject"
          busy={busy}
          onConfirm={confirmReject}
          onCancel={() => {
            if (!busy) setRejectPrompt(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default function SparkWalkups() {
  const [tab, setTab] = useState<WalkupsTab>("codes");
  const [filter, setFilter] = useState<Filter>("pending");
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <SparkPageHeader
        className="mb-4"
        eyebrow="WORKSPACE"
        title="Walk-ups"
        support={
          tab === "codes"
            ? "Standing check-in links for each brand. Share the live code."
            : tab === "queue"
              ? "Self-serve clock-ins from a check-in link or event code. Confirm to count hours, or reject."
              : "Generic clock in/out pages for any crew. Punches save GPS and land in a Sheet."
        }
      />

      <div className="flex items-center gap-5 mb-5" style={{ borderBottom: "1px solid var(--spark-border)" }}>
        {(
          [
            ["codes", "Standing codes"],
            ["queue", "Walk-ups"],
            ["clock", "Clock links"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="text-sm pb-2"
            style={{
              background: "transparent",
              border: "none",
              borderBottom:
                tab === id
                  ? "2px solid var(--spark-lime)"
                  : "2px solid transparent",
              color: tab === id ? "var(--spark-text)" : "rgba(var(--spark-ink-rgb),0.45)",
              fontWeight: tab === id ? 600 : 500,
              marginBottom: -1,
              paddingLeft: 0,
              paddingRight: 0,
            }}
          >
            {label}
            {id === "queue" ? <SidebarTabCount pick="pendingWalkups" /> : null}
          </button>
        ))}
      </div>

      {tab === "codes" ? (
        <Suspense fallback={null}>
          <StandingCheckinLink />
          <CheckinIssuesCard />
        </Suspense>
      ) : tab === "clock" ? (
        <ClockLinks />
      ) : (
        <>
          <div className="flex items-center gap-1 mb-5">
            {(["pending", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: filter === f ? "var(--spark-selected-bg)" : "transparent",
                  color: filter === f ? "var(--spark-selected-ink)" : "var(--spark-text)",
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
                style={{ color: "var(--spark-text-meta)" }}
              >
                Loading walk-ups…
              </p>
            }
          >
            <Inner filter={filter} refreshKey={refreshKey} bump={bump} />
          </Suspense>
        </>
      )}
    </div>
  );
}
