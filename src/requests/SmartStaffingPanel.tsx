/**
 * Smart-staffing panel for /request/view — sits alongside the per-
 * event Roster panel.
 *
 * Two parts:
 *   1. A fill-status header — "Confirmed M / Needed N" with a small
 *      progress bar. When the backend can't say how many BAs are
 *      needed (`needed` is null) we fall back to a plain
 *      "Assigned N · Confirmed M" line and hide the bar.
 *   2. A server-ranked suggestion list (nearest + best-rated +
 *      available first). Each row is selectable; rows that are
 *      already invited / already assigned are disabled and labelled.
 *      "Invite selected (N)" fires one bulk mutation, toasts the
 *      invited/skipped rollup, and bumps a fetchKey to refresh the
 *      staffing snapshot.
 *
 * Loads lazily behind a Suspense boundary so the Request View paints
 * first — same pattern as EventRosterPanel.
 */

import React, { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { EventStaffingQuery } from "@/api/queries/EventStaffingQuery";
import type { EventStaffingQuery as EventStaffingQueryType } from "@api/queries/__generated__/EventStaffingQuery.graphql";
import { BulkInviteAmbassadorsToShiftMutation } from "@/api/mutations/BulkInviteAmbassadorsToShiftMutation";
import type { BulkInviteAmbassadorsToShiftMutation as BulkInviteAmbassadorsToShiftMutationType } from "@api/mutations/__generated__/BulkInviteAmbassadorsToShiftMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

// Ask for a generous-but-bounded set of suggestions. The server
// ranks them; we just render the order it returns.
const SUGGESTION_LIMIT = 25;

type Suggestion = NonNullable<
  EventStaffingQueryType["response"]["eventStaffing"]
>["suggestions"][number];

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "BA";

const Inner: React.FC<{ eventId: string; eventLabel: string }> = ({
  eventId,
  eventLabel,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  // Bumping this re-fetches the staffing snapshot after a bulk invite
  // so the fill counts + already-invited flags reflect the new state.
  // store-and-network (not store-or-network) so the bump actually
  // hits the network rather than serving the stale store.
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<EventStaffingQueryType>(
    EventStaffingQuery,
    { eventId, limit: SUGGESTION_LIMIT },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [commitBulkInvite, isInviting] =
    useMutation<BulkInviteAmbassadorsToShiftMutationType>(
      BulkInviteAmbassadorsToShiftMutation,
    );

  const staffing = data.eventStaffing;

  // Suggestions arrive pre-ranked from the server. We don't reorder —
  // we only mark which rows are still selectable.
  const suggestions: Suggestion[] = useMemo(
    () => (staffing?.suggestions ?? []).filter(Boolean),
    [staffing],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const inviteSelected = () => {
    if (selectedIds.size === 0 || isInviting) return;
    // Only send ids that are still eligible — never re-invite an
    // already-invited / already-assigned BA even if a stale tick is
    // hanging around in the selection set.
    const eligible = suggestions.filter(
      (s) =>
        selectedIds.has(s.id) && !s.alreadyInvited && !s.alreadyAssigned,
    );
    const ambassadorIds = eligible.map((s) => s.id);
    if (ambassadorIds.length === 0) {
      showAlert("Nothing new to invite — already on the shift.", "info");
      return;
    }
    commitBulkInvite({
      variables: { input: { eventId, ambassadorIds } },
      onCompleted: (resp) => {
        const r = resp.bulkInviteAmbassadorsToShift;
        if (r?.success) {
          showAlert(
            `Invited ${r.invited}, skipped ${r.skipped}`,
            r.invited > 0 ? "success" : "info",
          );
          setSelectedIds(new Set());
          // Refresh the snapshot so counts + already-invited flags
          // pick up the new AmbassadorEvent rows.
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(r?.message || "Couldn't send invites.", "error");
        }
      },
      onError: (err) => {
        showAlert(err.message || "Couldn't send invites.", "error");
      },
    });
  };

  // Header copy + progress. When `needed` is null the backend can't
  // tell us a target, so we drop the bar and show the plain
  // assigned/confirmed line.
  const assigned = staffing?.assigned ?? 0;
  const confirmed = staffing?.confirmed ?? 0;
  const needed = staffing?.needed ?? null;
  // Prefer the server's fillRate when present; otherwise derive a
  // clamped 0–1 ratio from confirmed / needed for the bar width.
  const ratio = (() => {
    if (needed == null || needed <= 0) return null;
    const raw =
      staffing?.fillRate != null ? staffing.fillRate : confirmed / needed;
    return Math.max(0, Math.min(1, raw));
  })();

  const selectedCount = selectedIds.size;

  return (
    <div className="spark-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          SMART STAFFING · {eventLabel.toUpperCase()}
        </p>
        {needed != null ? (
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color:
                ratio != null && ratio >= 1
                  ? "var(--spark-lime)"
                  : "rgba(255,255,255,0.6)",
            }}
          >
            CONFIRMED {confirmed} / NEEDED {needed}
          </span>
        ) : (
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-text-secondary)",
            }}
          >
            ASSIGNED {assigned} · CONFIRMED {confirmed}
          </span>
        )}
      </div>

      {/* Progress bar — only when we know the target. */}
      {ratio != null && (
        <div
          className="mb-4 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
          aria-hidden
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(ratio * 100)}%`,
              background: "var(--spark-lime)",
              transition: "width 240ms ease",
            }}
          />
        </div>
      )}

      {suggestions.length === 0 ? (
        <p
          className="text-xs"
          style={{ color: "var(--spark-text-meta)" }}
        >
          No BA suggestions for this shift right now.
        </p>
      ) : (
        <div>
          {suggestions.map((s) => {
            const locked = s.alreadyInvited || s.alreadyAssigned;
            const checked = selectedIds.has(s.id);
            const onRowClick = () => {
              if (locked) return;
              toggleSelected(s.id);
            };
            return (
              <div
                key={s.id}
                onClick={onRowClick}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: locked ? "default" : "pointer",
                  background: checked ? "rgba(242,243,238,0.06)" : "transparent",
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelected(s.id)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={locked}
                  className="shrink-0 cursor-pointer"
                  style={{
                    accentColor: "var(--spark-lime)",
                    width: 16,
                    height: 16,
                  }}
                />
                <div
                  className="rounded-full grid place-items-center font-bold shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    background: "rgba(242,243,238,0.10)",
                    color: "var(--spark-lime)",
                    fontSize: 12,
                  }}
                >
                  {initials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.12em",
                        color: "var(--spark-gold)",
                      }}
                      title={`${s.rating} / 5 rating`}
                    >
                      ★ {s.rating}
                    </span>
                    {s.distanceMiles != null && (
                      <span
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.12em",
                          color: "var(--spark-text-meta)",
                        }}
                      >
                        {s.distanceMiles.toFixed(1)} mi
                      </span>
                    )}
                    {s.isAvailable === true && (
                      <span
                        className="mono text-[9px] shrink-0"
                        style={{
                          letterSpacing: "0.16em",
                          color: "var(--spark-lime)",
                          background: "rgba(242,243,238,0.10)",
                          border: "1px solid rgba(242,243,238,0.30)",
                          padding: "1px 6px",
                          borderRadius: 999,
                        }}
                      >
                        AVAILABLE
                      </span>
                    )}
                  </div>
                </div>
                {locked && (
                  <span
                    className="mono text-[10px] shrink-0"
                    style={{
                      letterSpacing: "0.16em",
                      color: s.alreadyAssigned
                        ? "var(--spark-lime)"
                        : "var(--spark-gold)",
                      paddingRight: 4,
                    }}
                  >
                    {s.alreadyAssigned ? "✓ ASSIGNED" : "✓ INVITED"}
                  </span>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-3 mt-4">
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color:
                  selectedCount > 0
                    ? "var(--spark-lime)"
                    : "rgba(255,255,255,0.35)",
              }}
            >
              {selectedCount === 0
                ? "TAP ROWS TO SELECT"
                : `${selectedCount} SELECTED`}
            </span>
            <button
              onClick={inviteSelected}
              disabled={isInviting || selectedCount === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow:
                  selectedCount > 0
                    ? "0 0 16px rgba(242,243,238,0.35)"
                    : "none",
              }}
            >
              {isInviting
                ? "Inviting…"
                : `Invite selected (${selectedCount})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SmartStaffingPanel: React.FC<{
  eventId: string;
  eventLabel: string;
}> = ({ eventId, eventLabel }) => {
  return (
    <Suspense
      fallback={
        <div
          className="spark-card p-5 text-xs"
          style={{ color: "var(--spark-text-meta)" }}
        >
          Loading smart staffing…
        </div>
      }
    >
      <Inner eventId={eventId} eventLabel={eventLabel} />
    </Suspense>
  );
};

export default SmartStaffingPanel;
