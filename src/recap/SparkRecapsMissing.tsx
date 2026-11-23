import { isWalkupPlaceholderEmail, walkupPhoneFromEmail } from "@/utils/clientSafeBaName";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  fetchQuery,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay/hooks";
import { Navigate, useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { showsMissingRecaps } from "@/field/missingRecaps";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { MissingRecapEventsQuery } from "@/api/queries/MissingRecapEventsQuery";
import type { MissingRecapEventsQuery as MissingRecapEventsQueryType } from "@api/queries/__generated__/MissingRecapEventsQuery.graphql";
import { NudgeAmbassadorForRecapMutation } from "@/api/mutations/NudgeAmbassadorForRecapMutation";
import type { NudgeAmbassadorForRecapMutation as NudgeAmbassadorForRecapMutationType } from "@api/mutations/__generated__/NudgeAmbassadorForRecapMutation.graphql";
import { DismissMissingRecapsMutation } from "@/api/mutations/DismissMissingRecapsMutation";
import type { DismissMissingRecapsMutation as DismissMissingRecapsMutationType } from "@api/mutations/__generated__/DismissMissingRecapsMutation.graphql";
import { RestoreMissingRecapsMutation } from "@/api/mutations/RestoreMissingRecapsMutation";
import type { RestoreMissingRecapsMutation as RestoreMissingRecapsMutationType } from "@api/mutations/__generated__/RestoreMissingRecapsMutation.graphql";
import { refreshSidebarCounts } from "@/hooks/useSidebarCounts";
import useSparkRole from "@/hooks/useSparkRole";
import ImportConnecteamButton from "./ImportConnecteamButton";
import DismissRecapMenu from "./DismissRecapMenu";
import DismissedRecapsList from "./DismissedRecapsList";
import {
  dismissTargetCount,
  dismissTargetsForEvents,
  dismissedMessage,
  type DismissReason,
  type DismissTargets,
} from "./missingRecapDismiss";
import {
  formatLastNudgedAt,
  overdueNudgeTargets,
} from "./nudgeAllOverdue";

/**
 * /recaps/missing — admin drill-down for events that already wrapped
 * but don't have a recap filed yet.
 *
 * Reads from `missingRecapEvents`. Per row:
 *   - Event identity (name / venue / state / overdue chip)
 *   - List of assigned BAs with a "Nudge" button per BA (fires the
 *     push notification)
 *   - "File for them" link → /recap/create?event=<uuid>&ambassador=<uuid>
 *   - Deep-link to the parent request if there is one
 *
 * The drill-down complements the sidebar "N RECAPS DUE" badge from
 * PR #215 — that badge surfaces the count; this page is where the
 * admin actually clears the queue.
 *
 * A row that will never get a recap (no-show, test shift, filed outside
 * Spark…) can be dismissed with a reason — per ambassador, or for every
 * row of the selected events. Dismissed rows leave the list, the badge
 * and the reminders; the "Dismissed" tab lists them and restores them.
 */

type LookbackKey = "7" | "30" | "90";

const fmtDate = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const overdueChipStyle = (
  hoursOverdue: number | null,
): { background: string; color: string; border: string; label: string } => {
  if (hoursOverdue == null) {
    return {
      background: "rgba(var(--spark-ink-rgb),0.05)",
      color: "var(--spark-text-meta)",
      border: "1px solid rgba(var(--spark-ink-rgb),0.15)",
      label: "Overdue",
    };
  }
  if (hoursOverdue >= 72) {
    return {
      background: "rgba(239,90,42,0.16)",
      color: "var(--spark-orange)",
      border: "1px solid rgba(239,90,42,0.45)",
      label: `Overdue ${Math.floor(hoursOverdue / 24)}d`,
    };
  }
  if (hoursOverdue >= 24) {
    return {
      background: "rgba(255,200,60,0.12)",
      color: "var(--spark-warn-ink, #f5c042)",
      border: "1px solid rgba(255,200,60,0.35)",
      label: `Overdue ${Math.floor(hoursOverdue / 24)}d`,
    };
  }
  return {
    background: "rgba(var(--spark-accent-rgb),0.08)",
    color: "var(--spark-lime)",
    border: "1px solid rgba(var(--spark-accent-rgb),0.25)",
    label: `Overdue ${hoursOverdue}h`,
  };
};

const Inner: React.FC<{
  tenantId: string | null;
  lookbackDays: number;
  /** Ignite staff: show the Dismiss actions. The server enforces it. */
  canDismiss: boolean;
}> = ({ tenantId, lookbackDays, canDismiss }) => {
  const navigate = useNavigate();
  const environment = useRelayEnvironment();
  const showAlert = useAlertStore((s) => s.showAlert);
  const showUndoable = useAlertStore((s) => s.showUndoable);

  const data = useLazyLoadQuery<MissingRecapEventsQueryType>(
    MissingRecapEventsQuery,
    { tenantId: tenantId ?? null, lookbackDays },
    { fetchPolicy: "store-or-network" },
  );

  const rows = useMemo(
    () => data?.missingRecapEvents ?? [],
    [data],
  );

  const [commitNudge, isNudging] =
    useMutation<NudgeAmbassadorForRecapMutationType>(
      NudgeAmbassadorForRecapMutation,
    );

  // Tracks the row currently being nudged so a row's button can show
  // "Sending…" without freezing the others.
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  const [commitDismiss] = useMutation<DismissMissingRecapsMutationType>(
    DismissMissingRecapsMutation,
  );
  const [commitRestore] = useMutation<RestoreMissingRecapsMutationType>(
    RestoreMissingRecapsMutation,
  );
  // Which Dismiss control is working: an ambassador row, an event, or "bulk".
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);

  // Re-pull the list and the sidebar badge after a dismissal or a restore.
  // fetchQuery writes into the store, so the list updates in place without
  // dropping back to the loading card.
  const refresh = () => {
    void fetchQuery<MissingRecapEventsQueryType>(
      environment,
      MissingRecapEventsQuery,
      { tenantId: tenantId ?? null, lookbackDays },
      { fetchPolicy: "network-only" },
    )
      .toPromise()
      .catch(() => undefined);
    void refreshSidebarCounts(environment, tenantId);
  };

  const restore = (dismissalUuids: ReadonlyArray<string>) => {
    commitRestore({
      variables: { input: { dismissalUuids: [...dismissalUuids] } },
      onCompleted: (res) => {
        const out = res.restoreMissingRecaps;
        if (out?.success) {
          refresh();
          showAlert("Restored. Back on Missing recaps.", "success");
        } else {
          showAlert(out?.message ?? "Could not undo that.", "warning");
        }
      },
      onError: (err) => showAlert(err.message || "Could not undo that.", "error"),
    });
  };

  const dismiss = (
    targets: DismissTargets,
    reason: DismissReason,
    note: string,
    key: string,
  ) => {
    if (dismissingKey || dismissTargetCount(targets) === 0) return;
    setDismissingKey(key);
    commitDismiss({
      variables: {
        input: {
          ambassadorEventUuids: targets.ambassadorEventUuids,
          eventUuids: targets.eventUuids,
          reason,
          note: note || null,
        },
      },
      onCompleted: (res) => {
        setDismissingKey(null);
        const out = res.dismissMissingRecaps;
        if (!out?.success) {
          showAlert(out?.message ?? "Could not dismiss that.", "warning");
          return;
        }
        if (key === "bulk") setSelectedEvents(new Set());
        refresh();
        const uuids = out.dismissalUuids;
        // Already dismissed on the server; Undo restores it. Nothing is
        // held back, so the toast closing does nothing.
        showUndoable(dismissedMessage(out.dismissedCount), () => undefined, {
          durationMs: 8000,
          onUndo: () => restore(uuids),
        });
      },
      onError: (err) => {
        setDismissingKey(null);
        showAlert(err.message || "Could not dismiss that.", "error");
      },
    });
  };

  // Event-level selection for bulk nudge (nudging an event nudges every
  // assigned BA on it via the same per-BA mutation).
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isBulkNudging, setIsBulkNudging] = useState(false);
  const toggleEvent = (eventUuid: string) =>
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventUuid)) next.delete(eventUuid);
      else next.add(eventUuid);
      return next;
    });
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedEvents.has(r.eventUuid)),
    [rows, selectedEvents],
  );
  const selectedBaCount = useMemo(
    () =>
      selectedRows.reduce((n, r) => n + r.assignedAmbassadors.length, 0),
    [selectedRows],
  );
  const selectedTargets = useMemo(
    () => dismissTargetsForEvents(selectedRows),
    [selectedRows],
  );
  const allSelected =
    rows.length > 0 && rows.every((r) => selectedEvents.has(r.eventUuid));
  const toggleAll = () =>
    setSelectedEvents(
      allSelected ? new Set() : new Set(rows.map((r) => r.eventUuid)),
    );

  type NudgeResult = {
    success: boolean;
    message?: string | null;
    devicesNotified?: number | null;
  };
  const nudgeOne = (ambassadorEventUuid: string): Promise<NudgeResult> =>
    new Promise((resolve) => {
      commitNudge({
        variables: { input: { ambassadorEventUuid } },
        onCompleted: (res) =>
          resolve(
            res.nudgeAmbassadorForRecap ?? { success: false, message: null },
          ),
        onError: (err) => resolve({ success: false, message: err.message }),
      });
    });

  const nudge = (
    ambassadorEventUuid: string,
    venueLabel: string,
    name: string,
  ) => {
    if (isNudging) return;
    setNudgingId(ambassadorEventUuid);
    void nudgeOne(ambassadorEventUuid).then((r) => {
      setNudgingId(null);
      if (r.success) {
        refresh();
        showAlert(
          `${name} nudged for ${venueLabel}${
            r.devicesNotified != null
              ? ` (${r.devicesNotified} device${r.devicesNotified === 1 ? "" : "s"})`
              : ""
          }.`,
          "success",
        );
      } else {
        showAlert(r.message ?? "Nudge failed.", "warning");
      }
    });
  };

  const nudgeSelected = async () => {
    if (isBulkNudging || isNudging || selectedBaCount === 0) return;
    setIsBulkNudging(true);
    let okCount = 0;
    const failures: string[] = [];
    // Sequential — same mutation as the per-row button, one BA at a time.
    for (const row of selectedRows) {
      for (const ba of row.assignedAmbassadors) {
        setNudgingId(ba.ambassadorEventUuid);
        const r = await nudgeOne(ba.ambassadorEventUuid);
        if (r.success) okCount += 1;
        else failures.push(`${ba.name}: ${r.message ?? "nudge failed"}`);
      }
    }
    setNudgingId(null);
    setIsBulkNudging(false);
    setSelectedEvents(new Set());
    refresh();
    if (failures.length === 0) {
      showAlert(
        `Nudged ${okCount} BA${okCount === 1 ? "" : "s"} across ${selectedRows.length} event${selectedRows.length === 1 ? "" : "s"}.`,
        "success",
      );
    } else if (okCount > 0) {
      showAlert(
        `Nudged ${okCount}, failed ${failures.length}: ${failures[0]}`,
        "warning",
      );
    } else {
      showAlert(`Nudge failed: ${failures[0] ?? "unknown error"}`, "error");
    }
  };

  // Tick so a page left open past the 12h cooldown re-includes BAs
  // without waiting for a query refetch. 60s is plenty for the chip
  // labels and bulk count; cooldown is hours-scale.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // One-click weekend clear-out: every BA on shifts overdue ≥24h,
  // skipping anyone nudged in the last 12 hours. Same mutation as
  // the per-row Nudge button.
  const overdueTargets = useMemo(
    () => overdueNudgeTargets(rows, nowMs),
    [rows, nowMs],
  );
  const nudgeAllOverdue = async () => {
    if (isBulkNudging || isNudging || overdueTargets.length === 0) return;
    setIsBulkNudging(true);
    let okCount = 0;
    const failures: string[] = [];
    const eventIds = new Set<string>();
    for (const t of overdueTargets) {
      setNudgingId(t.ambassadorEventUuid);
      const r = await nudgeOne(t.ambassadorEventUuid);
      if (r.success) {
        okCount += 1;
        eventIds.add(t.eventUuid);
      } else {
        failures.push(`${t.name}: ${r.message ?? "nudge failed"}`);
      }
    }
    setNudgingId(null);
    setIsBulkNudging(false);
    refresh();
    if (failures.length === 0) {
      showAlert(
        `Nudged ${okCount} overdue BA${okCount === 1 ? "" : "s"} across ${eventIds.size} event${eventIds.size === 1 ? "" : "s"}.`,
        "success",
      );
    } else if (okCount > 0) {
      showAlert(
        `Nudged ${okCount} overdue, skipped/failed ${failures.length}: ${failures[0]}`,
        "warning",
      );
    } else {
      showAlert(
        `Nudge all overdue failed: ${failures[0] ?? "unknown error"}`,
        "error",
      );
    }
  };

  if (rows.length === 0) {
    return (
      <SparkEmptyState
        done
        title="All clear"
        body={`No shift in the last ${lookbackDays} day${lookbackDays === 1 ? "" : "s"} is owing a recap.`}
      />
    );
  }

  // CSV export of the visible rows. Same format as the Master
  // Tracker / Recaps page exports — one row per (event, assigned
  // BA) pair so the spreadsheet can be sorted by BA without losing
  // the event context. Events with no assignments still get one row
  // (empty BA columns) so the count matches the on-screen list.
  const exportCsv = () => {
    if (rows.length === 0) {
      window.alert("Nothing to export.");
      return;
    }
    const esc = (raw: string | number | null | undefined) => {
      const s = (raw ?? "").toString();
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = [
      "Event UUID",
      "Event Name",
      "Venue",
      "Address",
      "State",
      "Date",
      "Hours Overdue",
      "BA Name",
      "BA Email",
      "BA Invite Status",
      "Ambassador Event UUID",
      "Request UUID",
    ];
    const lines = [header.join(",")];
    for (const row of rows) {
      const bas = row.assignedAmbassadors.length > 0
        ? row.assignedAmbassadors
        : [
            {
              name: "",
              email: "",
              isApproved: false,
              ambassadorEventUuid: "",
            },
          ];
      for (const ba of bas) {
        lines.push(
          [
            row.eventUuid,
            row.eventName,
            row.venue ?? "",
            row.address ?? "",
            row.stateCode ?? "",
            row.date ?? row.endTime ?? "",
            row.hoursOverdue ?? "",
            ba.name,
            ba.email ?? "",
            ba.name ? (ba.isApproved ? "accepted" : "pending") : "",
            ba.ambassadorEventUuid,
            row.requestUuid ?? "",
          ]
            .map(esc)
            .join(","),
        );
      }
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `spark-recaps-missing-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div
        className="flex items-center justify-between gap-3 flex-wrap text-[10px]"
        style={{ paddingBottom: 2 }}
      >
        <span
          className="mono flex items-center gap-3"
          style={{
            letterSpacing: "0.16em",
            color: "var(--spark-text-meta)",
          }}
        >
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all events"
            />
            All
          </label>
          {rows.length} event{rows.length === 1 ? "" : "s"} owing a recap
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void nudgeAllOverdue()}
            disabled={
              isBulkNudging || isNudging || overdueTargets.length === 0
            }
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
            }}
            title={
              overdueTargets.length === 0
                ? "No shifts overdue 24h+ (or everyone was nudged in the last 12 hours)"
                : `Push 'Don't forget your recap' to ${overdueTargets.length} BA${overdueTargets.length === 1 ? "" : "s"} on shifts overdue 24h+ (skips nudged in last 12h)`
            }
          >
            {isBulkNudging
              ? "Nudging…"
              : `Nudge all overdue${overdueTargets.length > 0 ? ` (${overdueTargets.length})` : ""}`}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="mono"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-lime)",
            }}
            title="Download the visible list as CSV — one row per (event, BA) pair"
          >
            Export CSV
          </button>
        </div>
      </div>
      {selectedEvents.size > 0 && (
        <div
          className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl"
          style={{
            background: "rgba(var(--spark-accent-rgb),0.08)",
            border: "1px solid rgba(var(--spark-accent-rgb),0.28)",
          }}
        >
          <span
            className="mono text-[11px]"
            style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}
          >
            {selectedEvents.size} selected · {selectedBaCount} ambassador
            {selectedBaCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => void nudgeSelected()}
            disabled={isBulkNudging || isNudging || selectedBaCount === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
            title={
              selectedBaCount === 0
                ? "Selected events have no assigned BA to nudge"
                : "Push 'Don't forget your recap' to every assigned BA on the selected events"
            }
          >
            {isBulkNudging ? "Nudging…" : "Nudge selected"}
          </button>
          {canDismiss && (
            <DismissRecapMenu
              label="Dismiss selected"
              busy={dismissingKey === "bulk"}
              disabled={isBulkNudging || dismissingKey !== null}
              title="No recap is owed for any row of the selected events. Choose a reason."
              onDismiss={(reason, note) =>
                dismiss(selectedTargets, reason, note, "bulk")
              }
            />
          )}
          <button
            type="button"
            onClick={() => setSelectedEvents(new Set())}
            disabled={isBulkNudging}
            className="mono text-[10px] disabled:opacity-50"
            style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
          >
            Clear
          </button>
        </div>
      )}
      {rows.map((row) => {
        const chip = overdueChipStyle(row.hoursOverdue ?? null);
        const venueLabel = row.venue || row.eventName;
        return (
          <div
            key={row.eventUuid}
            className="spark-card p-4"
            style={{ borderRadius: 14 }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <input
                type="checkbox"
                checked={selectedEvents.has(row.eventUuid)}
                onChange={() => toggleEvent(row.eventUuid)}
                aria-label={`Select ${venueLabel}`}
                className="mt-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="chip text-[10px] mono"
                    style={{
                      letterSpacing: "0.14em",
                      background: chip.background,
                      color: chip.color,
                      border: chip.border,
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {chip.label}
                  </span>
                  {row.stateCode && (
                    <span
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      {row.stateCode}
                    </span>
                  )}
                </div>
                <p className="font-bold truncate" title={venueLabel}>
                  {venueLabel}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {fmtDate(row.date ?? row.endTime ?? null)}
                  {row.address ? ` · ${row.address}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.requestUuid && (
                  <button
                    type="button"
                    onClick={() => navigate(`/request/view/${row.requestUuid}`)}
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    Open request
                  </button>
                )}
              </div>
            </div>

            {row.assignedAmbassadors.length === 0 ? (
              <div
                className="mt-3 px-3 py-2 rounded-xl text-xs"
                style={{
                  background: "rgba(255,200,60,0.08)",
                  border: "1px solid rgba(255,200,60,0.25)",
                  color: "var(--spark-text-secondary)",
                }}
              >
                No BA assigned — file the recap manually or assign someone to the
                shift first.
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      // Seed the recap picker's search (`q`) with the event
                      // name alongside the uuid. The create page pre-selects
                      // by finding the uuid within the loaded page (~30
                      // events), so for tenants with many events the target
                      // fell outside the page and wasn't auto-selected.
                      // Seeding the name-search guarantees the event is in the
                      // results so the uuid match lands.
                      `/recap/create?event=${row.eventUuid}&q=${encodeURIComponent(row.eventName)}`,
                    )
                  }
                  className="mono text-[10px] ml-3"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-lime)",
                  }}
                >
                  File now
                </button>
                {canDismiss && (
                  <span className="inline-block ml-3 align-middle">
                    <DismissRecapMenu
                      busy={dismissingKey === row.eventUuid}
                      disabled={dismissingKey !== null}
                      title="No recap is owed for this shift. Choose a reason."
                      onDismiss={(reason, note) =>
                        dismiss(
                          { ambassadorEventUuids: [], eventUuids: [row.eventUuid] },
                          reason,
                          note,
                          row.eventUuid,
                        )
                      }
                    />
                  </span>
                )}
              </div>
            ) : (
              <div
                className="mt-3 rounded-xl divide-y"
                style={{
                  background: "rgba(var(--spark-ink-rgb),0.025)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                {row.assignedAmbassadors.map((ba) => {
                  const busy = nudgingId === ba.ambassadorEventUuid;
                  return (
                    <div
                      key={ba.ambassadorEventUuid}
                      className="flex items-center gap-x-3 gap-y-2 px-3 py-2 flex-wrap"
                      style={{
                        borderColor: "var(--spark-border)",
                      }}
                    >
                      <div className="flex-1 min-w-0" style={{ minWidth: "9rem" }}>
                        <p className="text-sm truncate">
                          {ba.name}
                          {!ba.isApproved && (
                            <span
                              className="mono text-[10px] ml-2"
                              style={{
                                letterSpacing: "0.14em",
                                color: "rgba(255,200,60,0.85)",
                              }}
                            >
                              · Pending
                            </span>
                          )}
                        </p>
                        {ba.email && (
                          <p
                            className="mono text-[10px] truncate"
                            style={{
                              letterSpacing: "0.14em",
                              color: "var(--spark-text-meta)",
                            }}
                          >
                            {isWalkupPlaceholderEmail(ba.email)
                          ? `Walk-up · ${walkupPhoneFromEmail(ba.email) || "no phone on file"}`
                          : ba.email}
                          </p>
                        )}
                        {ba.lastNudgedAt && (
                          <p
                            className="mono text-[10px] mt-0.5"
                            style={{
                              letterSpacing: "0.14em",
                              color: "var(--spark-text-meta)",
                            }}
                            title={ba.lastNudgedAt}
                          >
                            Last nudged{" "}
                            {formatLastNudgedAt(ba.lastNudgedAt, nowMs)}
                            {ba.lastNudgeChannel
                              ? ` · ${ba.lastNudgeChannel}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            nudge(ba.ambassadorEventUuid, venueLabel, ba.name)
                          }
                          disabled={busy || isNudging || isBulkNudging}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                          style={{
                            background: "transparent",
                            color: "var(--spark-text)",
                            border: "1px solid var(--spark-border)",
                          }}
                          title="Push 'Don't forget your recap' to this BA"
                        >
                          {busy ? "Sending…" : "Nudge"}
                        </button>
                        {canDismiss && (
                          <DismissRecapMenu
                            busy={dismissingKey === ba.ambassadorEventUuid}
                            disabled={dismissingKey !== null}
                            onDismiss={(reason, note) =>
                              dismiss(
                                {
                                  ambassadorEventUuids: [ba.ambassadorEventUuid],
                                  eventUuids: [],
                                },
                                reason,
                                note,
                                ba.ambassadorEventUuid,
                              )
                            }
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/recap/create?event=${row.eventUuid}&ambassador=${ba.ambassadorUuid}&q=${encodeURIComponent(row.eventName)}`,
                            )
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{
                            background: "var(--spark-lime)",
                            color: "var(--spark-on-accent)",
                          }}
                          title="Open the recap form pre-scoped to this BA + event"
                        >
                          File for them
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function SparkRecapsMissing() {
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const [lookback, setLookback] = useState<LookbackKey>("30");
  const lookbackDays = Number(lookback);
  // Dismissing is for Ignite staff. Brand users never reach this page in
  // admin mode, and the server refuses them regardless.
  const { isAdmin } = useSparkRole();
  const [view, setView] = useState<"missing" | "dismissed">("missing");
  const environment = useRelayEnvironment();

  if (!showsMissingRecaps(tenantSlug, tenantMeta?.requestUrlName)) {
    return <Navigate to="/recaps/list" replace />;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 spark-scale">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              Recaps · Missing
            </p>
            <h1 className="display text-2xl font-bold">Shifts still owing a recap</h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Events that already wrapped but don't have a recap on file. Nudge the
              BA via push, or file the recap on their behalf.
              {isAdmin
                ? " Dismiss a row when no recap is owed; it can be restored."
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ImportConnecteamButton variant="ghost" />
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "var(--spark-text-meta)",
              }}
            >
              Lookback
            </span>
            <select
              value={lookback}
              onChange={(e) => setLookback(e.target.value as LookbackKey)}
              className="rounded-xl text-xs"
              style={{
                padding: "0.45rem 0.9rem",
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                outline: "none",
              }}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        </div>

        {isAdmin && (
          <div className="pill-group" role="tablist" aria-label="Missing recaps">
            <button
              type="button"
              role="tab"
              aria-selected={view === "missing"}
              className={`pill-btn ${view === "missing" ? "on" : ""}`}
              onClick={() => setView("missing")}
            >
              Missing
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "dismissed"}
              className={`pill-btn ${view === "dismissed" ? "on" : ""}`}
              onClick={() => setView("dismissed")}
            >
              Dismissed
            </button>
          </div>
        )}

        {isAdmin && view === "dismissed" ? (
          <DismissedRecapsList
            tenantId={tenantId ?? null}
            lookbackDays={lookbackDays}
            onRestored={() => {
              // The Missing tab reads the store: refetch so the restored
              // row is there when the tab is opened, and fix the badge.
              void fetchQuery<MissingRecapEventsQueryType>(
                environment,
                MissingRecapEventsQuery,
                { tenantId: tenantId ?? null, lookbackDays },
                { fetchPolicy: "network-only" },
              )
                .toPromise()
                .catch(() => undefined);
              void refreshSidebarCounts(environment, tenantId);
            }}
          />
        ) : (
          <Suspense
            fallback={
              <div
                className="spark-card p-8 text-center"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Loading missing recaps…
              </div>
            }
          >
            <Inner
              tenantId={tenantId ?? null}
              lookbackDays={lookbackDays}
              canDismiss={isAdmin}
            />
          </Suspense>
        )}
      </div>
    </Layout>
  );
}
