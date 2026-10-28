import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { StaffingBoardQuery } from "@/api/queries/StaffingBoardQuery";
import type { StaffingBoardQuery as StaffingBoardQueryType } from "@api/queries/__generated__/StaffingBoardQuery.graphql";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import { BulkAssignAmbassadorMutation } from "@/api/mutations/BulkAssignAmbassadorMutation";
import type { BulkAssignAmbassadorMutation as BulkAssignAmbassadorMutationType } from "@api/mutations/__generated__/BulkAssignAmbassadorMutation.graphql";
import { RebookLastCrewMutation } from "@/api/mutations/RebookLastCrewMutation";
import type { RebookLastCrewMutation as RebookLastCrewMutationType } from "@api/mutations/__generated__/RebookLastCrewMutation.graphql";
import InviteBAModal from "@/requests/InviteBAModal";

/**
 * Staffing Board — a week grid of shifts × dates so an admin can see who's
 * assigned where at a glance and fill gaps fast. Rows = venue (store/event),
 * columns = the 7 days in view. An empty/under-staffed cell opens the existing
 * assign flow (InviteBAModal, which defaults to "Assign now"). Unstaffed shifts
 * are counted + highlighted so gaps can't hide.
 *
 * Bulk mode: flip "Bulk assign" on, tap every slot you want to fill, then pick
 * ONE BA to book onto all of them at once (bulkAssignAmbassadorToEvents).
 */
type Shift = StaffingBoardQueryType["response"]["staffingBoard"][number];

// Local YYYY-MM-DD for a Date (grid columns + query range), no tz surprises.
const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Bucket key for a shift's date — take the calendar day verbatim off the ISO
// string (event.date is midnight UTC; slicing avoids a tz shift).
const shiftDayKey = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  return String(iso).slice(0, 10);
};

const fmtTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "BA";

type AssignTarget = {
  eventId: string;
  eventDate: string | null;
  eventAddress: string | null;
  alreadyIds: string[];
};

/**
 * A compact "pick one BA" modal for bulk assignment — lists the tenant's
 * active BAs (searchable) and hands the chosen ambassador global-id back.
 * Loads its own query lazily so the board isn't slowed by it until opened.
 */
const BulkBaPicker: React.FC<{
  count: number;
  busy: boolean;
  onPick: (ambassadorId: string, name: string) => void;
  onClose: () => void;
}> = ({ count, busy, onPick, onClose }) => {
  const [q, setQ] = useState("");
  const data = useLazyLoadQuery<AmbassadorsListQueryType>(
    AmbassadorsListQuery,
    { first: 200 },
    { fetchPolicy: "store-or-network" },
  );

  const people = useMemo(() => {
    const rows = (data?.ambassadors?.edges ?? [])
      .map((e) => e?.node)
      .filter(Boolean)
      .map((n) => {
        const first = n?.user?.firstName ?? "";
        const last = n?.user?.lastName ?? "";
        const name = `${first} ${last}`.trim() || n?.user?.email || "BA";
        return { id: n!.id as string, name, isActive: !!n?.isActive };
      })
      .filter((p) => p.isActive);
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((p) => p.name.toLowerCase().includes(needle))
      : rows;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--spark-panel, #14181a)",
          border: "1px solid var(--spark-border)",
          maxHeight: "80vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <h3 className="text-base font-bold">Assign a BA</h3>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            Books this BA onto the {count} selected shift
            {count === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="px-5 pt-3 pb-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search BAs…"
            disabled={busy}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--spark-bg, #0d0f10)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          />
        </div>
        <div className="overflow-y-auto px-3 pb-3" style={{ minHeight: 80 }}>
          {people.length === 0 ? (
            <p
              className="p-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              No active BAs match.
            </p>
          ) : (
            people.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => onPick(p.id, p.name)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left"
                style={{ opacity: busy ? 0.5 : 1 }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span
                  className="grid place-items-center rounded-full text-[10px] font-bold shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    background: "rgba(242,243,238,0.15)",
                    color: "var(--spark-lime)",
                  }}
                >
                  {initials(p.name)}
                </span>
                <span className="text-sm">{p.name}</span>
              </button>
            ))
          )}
        </div>
        <div
          className="px-5 py-3 flex justify-end"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const Inner: React.FC<{
  weekStart: Date;
  refreshKey: number;
  onAssigned: () => void;
}> = ({ weekStart, refreshKey, onAssigned }) => {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const startDate = ymd(days[0]);
  const endDate = ymd(days[6]);

  const data = useLazyLoadQuery<StaffingBoardQueryType>(
    StaffingBoardQuery,
    { startDate, endDate },
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );
  const shifts: Shift[] = (data?.staffingBoard ?? []).filter(Boolean) as Shift[];

  const [assign, setAssign] = useState<AssignTarget | null>(null);

  // Bulk assign
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [commitBulk, isAssigning] = useMutation<BulkAssignAmbassadorMutationType>(
    BulkAssignAmbassadorMutation,
  );
  const [commitRebook, isRebooking] =
    useMutation<RebookLastCrewMutationType>(RebookLastCrewMutation);
  const [rebookingId, setRebookingId] = useState<string | null>(null);

  const runRebook = (eventId: string) => {
    setRebookingId(eventId);
    commitRebook({
      variables: { input: { eventId } },
      onCompleted: (res) => {
        setRebookingId(null);
        const r = res?.rebookLastCrew;
        setBanner({ ok: !!r?.success, text: r?.message || "Re-booked." });
        if (r?.success) onAssigned();
        window.setTimeout(() => setBanner(null), 6000);
      },
      onError: (err) => {
        setRebookingId(null);
        setBanner({ ok: false, text: err?.message || "Re-book failed." });
      },
    });
  };

  const toggleSelect = (eventId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

  const exitBulk = () => {
    setBulkMode(false);
    setSelected(new Set());
    setPickerOpen(false);
  };

  const runBulkAssign = (ambassadorId: string, name: string) => {
    const eventIds = [...selected];
    if (eventIds.length === 0) return;
    commitBulk({
      variables: { input: { ambassadorId, eventIds } },
      onCompleted: (res) => {
        const r = res?.bulkAssignAmbassadorToEvents;
        setPickerOpen(false);
        setSelected(new Set());
        setBanner({
          ok: !!r?.success,
          text:
            r?.message ||
            `Assigned ${name} to ${eventIds.length} shift${eventIds.length === 1 ? "" : "s"}.`,
        });
        onAssigned();
        window.setTimeout(() => setBanner(null), 6000);
      },
      onError: (err) => {
        setPickerOpen(false);
        setBanner({ ok: false, text: err?.message || "Bulk assign failed." });
      },
    });
  };

  // Group into rows by venue (store || event name), keep the brand for the
  // row label, and index each shift by its day so cell lookup is O(1).
  const { rows, byRowDay, unstaffed } = useMemo(() => {
    const rowMap = new Map<
      string,
      { key: string; label: string; brand: string }
    >();
    const cell = new Map<string, Shift[]>(); // `${rowKey}|${dayKey}` → shifts
    let unstaffedCount = 0;
    for (const s of shifts) {
      const label = s.store || s.eventName || "(shift)";
      const rowKey = `${s.brandName}::${label}`;
      if (!rowMap.has(rowKey))
        rowMap.set(rowKey, { key: rowKey, label, brand: s.brandName });
      const dayKey = shiftDayKey(s.date);
      if (dayKey) {
        const k = `${rowKey}|${dayKey}`;
        const arr = cell.get(k) ?? [];
        arr.push(s);
        cell.set(k, arr);
      }
      if (!s.isStaffed) unstaffedCount += 1;
    }
    const rowList = [...rowMap.values()].sort((a, b) =>
      (a.brand + a.label).localeCompare(b.brand + b.label),
    );
    return { rows: rowList, byRowDay: cell, unstaffed: unstaffedCount };
  }, [shifts]);

  const openAssign = (s: Shift) =>
    setAssign({
      eventId: s.eventId,
      eventDate: s.date ?? null,
      eventAddress: s.address ?? null,
      alreadyIds: s.assigned.map((a) => a.ambassadorId),
    });

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span
          className="mono text-[11px]"
          style={{
            letterSpacing: "0.14em",
            color: unstaffed > 0 ? "var(--spark-orange)" : "var(--spark-lime)",
            background:
              unstaffed > 0 ? "rgba(239,90,42,0.12)" : "rgba(242,243,238,0.1)",
            border: `1px solid ${unstaffed > 0 ? "rgba(239,90,42,0.35)" : "rgba(242,243,238,0.3)"}`,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {unstaffed > 0
            ? `${unstaffed} SHIFT${unstaffed === 1 ? "" : "S"} UNSTAFFED`
            : "ALL SHIFTS STAFFED ✓"}
        </span>
        <span
          className="mono text-[11px]"
          style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}
        >
          {shifts.length} SHIFT{shifts.length === 1 ? "" : "S"} THIS WEEK
        </span>
        <button
          onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
          className="mono text-[11px] ml-auto rounded-full"
          style={{
            letterSpacing: "0.1em",
            padding: "4px 12px",
            color: bulkMode ? "#0a0d09" : "var(--spark-lime)",
            background: bulkMode ? "var(--spark-lime)" : "transparent",
            border: `1px solid ${bulkMode ? "var(--spark-lime)" : "rgba(242,243,238,0.35)"}`,
          }}
        >
          {bulkMode ? "✕ EXIT BULK" : "⊕ BULK ASSIGN"}
        </button>
      </div>

      {banner && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm"
          style={{
            color: banner.ok ? "var(--spark-lime)" : "var(--spark-orange)",
            background: banner.ok
              ? "rgba(242,243,238,0.1)"
              : "rgba(239,90,42,0.1)",
            border: `1px solid ${banner.ok ? "rgba(242,243,238,0.3)" : "rgba(239,90,42,0.3)"}`,
          }}
        >
          {banner.text}
        </div>
      )}

      {bulkMode && (
        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
          Tap the shifts you want to fill, then choose one BA to book onto all
          of them.
        </p>
      )}

      {rows.length === 0 ? (
        <p
          className="p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          No shifts scheduled this week.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 900, paddingBottom: bulkMode ? 72 : 0 }}>
            {/* Header row: venue + 7 days */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "200px repeat(7, minmax(112px, 1fr))",
                borderBottom: "1px solid var(--spark-border)",
              }}
            >
              <div
                className="mono text-[10px] px-3 py-2"
                style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.4)" }}
              >
                VENUE
              </div>
              {days.map((d) => (
                <div
                  key={ymd(d)}
                  className="mono text-[10px] px-2 py-2 text-center"
                  style={{
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.55)",
                    borderLeft: "1px solid var(--spark-border)",
                  }}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                  <br />
                  <span style={{ color: "rgba(255,255,255,0.35)" }}>
                    {d.toLocaleDateString(undefined, {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>

            {/* Body rows */}
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid"
                style={{
                  gridTemplateColumns: "200px repeat(7, minmax(112px, 1fr))",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <div className="px-3 py-2 min-w-0">
                  <p className="text-sm font-medium truncate">{row.label}</p>
                  <p
                    className="mono text-[9px] truncate"
                    style={{
                      letterSpacing: "0.1em",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {row.brand}
                  </p>
                </div>
                {days.map((d) => {
                  const cellShifts = byRowDay.get(`${row.key}|${ymd(d)}`) ?? [];
                  return (
                    <div
                      key={ymd(d)}
                      className="px-1.5 py-1.5 flex flex-col gap-1.5"
                      style={{ borderLeft: "1px solid var(--spark-border)" }}
                    >
                      {cellShifts.map((s) => {
                        const isSel = selected.has(s.eventId);
                        return (
                          <div
                            key={s.eventUuid}
                            className="rounded-lg p-1.5"
                            style={{
                              background: isSel
                                ? "rgba(242,243,238,0.18)"
                                : s.isStaffed
                                  ? "rgba(242,243,238,0.06)"
                                  : "rgba(239,90,42,0.06)",
                              border: `1px solid ${
                                isSel
                                  ? "var(--spark-lime)"
                                  : s.isStaffed
                                    ? "rgba(242,243,238,0.2)"
                                    : "rgba(239,90,42,0.25)"
                              }`,
                            }}
                          >
                            {s.startTime ? (
                              <p
                                className="mono text-[9px] mb-1"
                                style={{ color: "rgba(255,255,255,0.5)" }}
                              >
                                {fmtTime(s.startTime)}
                                {s.endTime ? `–${fmtTime(s.endTime)}` : ""}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-1 mb-1">
                              {s.assigned.map((a) => (
                                <span
                                  key={a.ambassadorUuid}
                                  title={`${a.name}${a.isApproved ? "" : " (pending)"}`}
                                  className="grid place-items-center rounded-full text-[9px] font-bold"
                                  style={{
                                    width: 20,
                                    height: 20,
                                    background: a.isApproved
                                      ? "var(--spark-lime)"
                                      : "rgba(255,196,0,0.2)",
                                    color: a.isApproved
                                      ? "#0a0d09"
                                      : "var(--spark-gold)",
                                    border: a.isApproved
                                      ? "none"
                                      : "1px solid var(--spark-gold)",
                                  }}
                                >
                                  {initials(a.name)}
                                </span>
                              ))}
                            </div>
                            <button
                              onClick={() =>
                                bulkMode
                                  ? toggleSelect(s.eventId)
                                  : openAssign(s)
                              }
                              className="mono text-[9px] w-full rounded"
                              style={{
                                letterSpacing: "0.08em",
                                padding: "3px 0",
                                color: bulkMode
                                  ? isSel
                                    ? "#0a0d09"
                                    : "var(--spark-lime)"
                                  : s.isStaffed
                                    ? "rgba(255,255,255,0.55)"
                                    : "var(--spark-lime)",
                                background: bulkMode
                                  ? isSel
                                    ? "var(--spark-lime)"
                                    : "rgba(242,243,238,0.1)"
                                  : s.isStaffed
                                    ? "transparent"
                                    : "rgba(242,243,238,0.1)",
                                border: `1px solid ${
                                  bulkMode
                                    ? "rgba(242,243,238,0.4)"
                                    : s.isStaffed
                                      ? "var(--spark-border)"
                                      : "rgba(242,243,238,0.3)"
                                }`,
                              }}
                            >
                              {bulkMode
                                ? isSel
                                  ? "✓ SELECTED"
                                  : "SELECT"
                                : s.assigned.length === 0
                                  ? "+ ASSIGN"
                                  : "+ ADD"}
                            </button>
                            {!bulkMode && s.assigned.length === 0 ? (
                              <button
                                onClick={() => runRebook(s.eventId)}
                                disabled={isRebooking}
                                className="mono text-[9px] w-full rounded mt-1"
                                style={{
                                  letterSpacing: "0.06em",
                                  padding: "3px 0",
                                  color: "rgba(255,255,255,0.6)",
                                  background: "transparent",
                                  border: "1px solid var(--spark-border)",
                                  opacity: isRebooking && rebookingId === s.eventId ? 0.5 : 1,
                                }}
                                title="Book the crew who worked this venue last time"
                              >
                                {rebookingId === s.eventId ? "…" : "↻ LAST CREW"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {bulkMode && (
        <div
          className="fixed left-0 right-0 bottom-0 z-40 px-5 py-3 flex items-center gap-3 flex-wrap"
          style={{
            background: "var(--spark-panel, #14181a)",
            borderTop: "1px solid var(--spark-border)",
          }}
        >
          <span className="text-sm font-semibold">
            {selected.size} shift{selected.size === 1 ? "" : "s"} selected
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="mono text-[11px]"
              style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}
            >
              CLEAR
            </button>
          )}
          <button
            onClick={() => setPickerOpen(true)}
            disabled={selected.size === 0 || isAssigning}
            className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background:
                selected.size === 0 ? "rgba(255,255,255,0.08)" : "var(--spark-lime)",
              color: selected.size === 0 ? "rgba(255,255,255,0.4)" : "#0a0d09",
              border: "none",
              cursor: selected.size === 0 ? "default" : "pointer",
            }}
          >
            {isAssigning ? "Assigning…" : "Assign a BA →"}
          </button>
        </div>
      )}

      {pickerOpen && (
        <Suspense fallback={null}>
          <BulkBaPicker
            count={selected.size}
            busy={isAssigning}
            onPick={runBulkAssign}
            onClose={() => setPickerOpen(false)}
          />
        </Suspense>
      )}

      {assign && (
        <InviteBAModal
          eventId={assign.eventId}
          alreadyInvitedAmbassadorIds={assign.alreadyIds}
          eventDate={assign.eventDate}
          eventAddress={assign.eventAddress}
          onClose={() => setAssign(null)}
          onInvited={() => {
            onAssigned();
          }}
        />
      )}
    </>
  );
};

export default function SparkStaffingBoard() {
  // Start the window on the Monday of the current week.
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - dow);
    return d;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  const shift = (weeks: number) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + weeks * 7);
    setWeekStart(d);
  };

  const rangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(weekStart)} – ${fmt(end)}`;
  }, [weekStart]);

  return (
    <div className="p-5 md:p-8">
      <p
        className="mono text-[10px] mb-1"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        WORKSPACE
      </p>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="display text-2xl font-bold">Staffing Board</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Who's on which shift this week. Tap a slot to assign.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            ← Prev
          </button>
          <span
            className="mono text-[12px] px-2"
            style={{ letterSpacing: "0.06em", color: "var(--spark-text)" }}
          >
            {rangeLabel}
          </span>
          <button
            onClick={() => shift(1)}
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Next →
          </button>
        </div>
      </div>

      <Suspense
        fallback={
          <p
            className="p-10 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading the week…
          </p>
        }
      >
        <Inner weekStart={weekStart} refreshKey={refreshKey} onAssigned={bump} />
      </Suspense>
    </div>
  );
}
