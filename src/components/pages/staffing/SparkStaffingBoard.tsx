import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { StaffingBoardQuery } from "@/api/queries/StaffingBoardQuery";
import type { StaffingBoardQuery as StaffingBoardQueryType } from "@api/queries/__generated__/StaffingBoardQuery.graphql";
import StaffingRoster from "./StaffingRoster";
import { shiftTime } from "@/components/dashboard/todayAttention";
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
export const BulkBaPicker: React.FC<{
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
          <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
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
              style={{ color: "var(--spark-text-meta)" }}
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
                  (e.currentTarget.style.background = "rgba(var(--spark-ink-rgb),0.05)")
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
                    background: "rgba(var(--spark-accent-rgb),0.15)",
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

/**
 * Row title for a shift. Prefer the store; otherwise use the event name
 * with its leading "11/10/2026 - " date stripped (the day is already the
 * column) and any trailing " · Retail Sampling" type suffix removed.
 */
function venueLabel(
  store: string | null | undefined,
  eventName: string | null | undefined,
): string {
  const st = (store ?? "").trim();
  if (st) return st;
  const cleaned = (eventName ?? "")
    .trim()
    .replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]\s*/, "")
    .replace(/\s+·\s+[^·]+$/, "")
    .trim();
  return cleaned || (eventName ?? "").trim() || "(shift)";
}

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
  const allShifts: Shift[] = useMemo(
    () => (data?.staffingBoard ?? []).filter(Boolean) as Shift[],
    [data],
  );

  // Board filters — client, unstaffed-only, and a venue search. The board
  // loads every client's shifts for the week, so the client picker is what
  // makes the scope visible ("All clients" by default).
  const [brandFilter, setBrandFilter] = useState("");
  const [unstaffedOnly, setUnstaffedOnly] = useState(false);
  const [view, setView] = useState<"venue" | "person">("venue");
  const [venueQuery, setVenueQuery] = useState("");
  const brands = useMemo(
    () =>
      [...new Set(allShifts.map((s) => s.brandName).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [allShifts],
  );
  const shifts: Shift[] = useMemo(() => {
    const q = venueQuery.trim().toLowerCase();
    return allShifts.filter((s) => {
      if (brandFilter && s.brandName !== brandFilter) return false;
      if (unstaffedOnly && s.isStaffed) return false;
      if (q) {
        const hay = `${s.store ?? ""} ${s.eventName ?? ""} ${s.address ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allShifts, brandFilter, unstaffedOnly, venueQuery]);
  const filtersActive = Boolean(brandFilter || unstaffedOnly || venueQuery.trim());
  const clearFilters = () => {
    setBrandFilter("");
    setUnstaffedOnly(false);
    setVenueQuery("");
  };

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
      const label = venueLabel(s.store, s.eventName);
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
              unstaffed > 0 ? "rgba(239,90,42,0.12)" : "rgba(var(--spark-accent-rgb),0.1)",
            border: `1px solid ${unstaffed > 0 ? "rgba(239,90,42,0.35)" : "rgba(var(--spark-accent-rgb),0.3)"}`,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {unstaffed > 0
            ? `${unstaffed} shift${unstaffed === 1 ? "" : "s"} unstaffed`
            : "All shifts staffed"}
        </span>
        <span
          className="mono text-[11px]"
          style={{ color: "var(--spark-text-meta)", letterSpacing: "0.1em" }}
        >
          {shifts.length} shift{shifts.length === 1 ? "" : "s"}{" "}
          {filtersActive ? `shown · ${allShifts.length} this week` : "this week"}
        </span>
        <button
          hidden={view === "person"}
          onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
          className="mono text-[11px] ml-auto rounded-full"
          style={{
            letterSpacing: "0.1em",
            padding: "4px 12px",
            color: bulkMode ? "var(--spark-selected-ink)" : "var(--spark-lime)",
            background: bulkMode ? "var(--spark-selected-bg)" : "transparent",
            border: `1px solid ${bulkMode ? "var(--spark-lime)" : "rgba(var(--spark-accent-rgb),0.35)"}`,
          }}
        >
          {bulkMode ? "Exit bulk assign" : "Bulk assign"}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="spark-viewswitch" role="group" aria-label="Board view">
          <button
            type="button"
            aria-pressed={view === "venue"}
            onClick={() => setView("venue")}
          >
            By venue
          </button>
          <button
            type="button"
            aria-pressed={view === "person"}
            onClick={() => {
              exitBulk();
              setView("person");
            }}
          >
            By person
          </button>
        </div>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          aria-label="Filter by client"
          className="text-sm rounded-xl px-3 py-2"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <option value="">All clients ({brands.length})</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input
          value={venueQuery}
          onChange={(e) => setVenueQuery(e.target.value)}
          placeholder="Search store or address"
          aria-label="Search store or address"
          className="text-sm rounded-xl px-3 py-2"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
            minWidth: 220,
          }}
        />
        <button
          type="button"
          onClick={() => setUnstaffedOnly((v) => !v)}
          aria-pressed={unstaffedOnly}
          className="text-sm rounded-xl px-3 py-2 font-semibold"
          style={{
            color: unstaffedOnly ? "var(--spark-on-accent)" : "var(--spark-text)",
            background: unstaffedOnly ? "var(--spark-orange)" : "transparent",
            border: `1px solid ${unstaffedOnly ? "var(--spark-orange)" : "var(--spark-border)"}`,
          }}
        >
          Unstaffed only
        </button>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm px-2 py-2 underline"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {banner && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm"
          style={{
            color: banner.ok ? "var(--spark-lime)" : "var(--spark-orange)",
            background: banner.ok
              ? "rgba(var(--spark-accent-rgb),0.1)"
              : "rgba(239,90,42,0.1)",
            border: `1px solid ${banner.ok ? "rgba(var(--spark-accent-rgb),0.3)" : "rgba(239,90,42,0.3)"}`,
          }}
        >
          {banner.text}
        </div>
      )}

      {bulkMode && (
        <p className="text-xs mb-3" style={{ color: "var(--spark-text-meta)" }}>
          Tap the shifts you want to fill, then choose one BA to book onto all
          of them.
        </p>
      )}

      {rows.length === 0 ? (
        <p
          className="p-10 text-center text-sm"
          style={{ color: "var(--spark-text-meta)" }}
        >
          {filtersActive
            ? "No shifts match these filters."
            : "No shifts scheduled this week."}
        </p>
      ) : view === "person" ? (
        <StaffingRoster
          days={days}
          shifts={shifts}
          showBrand={!brandFilter}
          venueOf={(s) => venueLabel(s.store, s.eventName)}
          hoursOf={(s) =>
            [shiftTime(s.startLocal ?? s.startTime), shiftTime(s.endLocal ?? s.endTime)]
              .filter(Boolean)
              .join("–")
          }
          onOpen={openAssign}
        />
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
                style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
              >
                Venue
              </div>
              {days.map((d) => (
                <div
                  key={ymd(d)}
                  className="mono text-[10px] px-2 py-2 text-center"
                  style={{
                    letterSpacing: "0.1em",
                    color: "var(--spark-text-meta)",
                    borderLeft: "1px solid var(--spark-border)",
                  }}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                  <br />
                  <span style={{ color: "var(--spark-text-meta)" }}>
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
                      color: "var(--spark-text-meta)",
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
                                ? "rgba(var(--spark-accent-rgb),0.18)"
                                : s.isStaffed
                                  ? "rgba(var(--spark-accent-rgb),0.06)"
                                  : "rgba(239,90,42,0.06)",
                              border: `1px solid ${
                                isSel
                                  ? "var(--spark-lime)"
                                  : s.isStaffed
                                    ? "rgba(var(--spark-accent-rgb),0.2)"
                                    : "rgba(239,90,42,0.25)"
                              }`,
                            }}
                          >
                            {s.startTime ? (
                              <p
                                className="mono text-[9px] mb-1"
                                style={{ color: "var(--spark-text-meta)" }}
                              >
                                {shiftTime(s.startLocal ?? s.startTime)}
                                {s.endTime ? `–${shiftTime(s.endLocal ?? s.endTime)}` : ""}
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
                                    // The fill flips with the appearance (ink in
                                    // light, off-white in dark); so must the text.
                                    color: a.isApproved
                                      ? "var(--spark-on-accent)"
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
                                    ? "rgba(var(--spark-ink-rgb),0.55)"
                                    : "var(--spark-lime)",
                                background: bulkMode
                                  ? isSel
                                    ? "var(--spark-lime)"
                                    : "rgba(var(--spark-accent-rgb),0.1)"
                                  : s.isStaffed
                                    ? "transparent"
                                    : "rgba(var(--spark-accent-rgb),0.1)",
                                border: `1px solid ${
                                  bulkMode
                                    ? "rgba(var(--spark-accent-rgb),0.4)"
                                    : s.isStaffed
                                      ? "var(--spark-border)"
                                      : "rgba(var(--spark-accent-rgb),0.3)"
                                }`,
                              }}
                            >
                              {bulkMode
                                ? isSel
                                  ? "Selected"
                                  : "Select"
                                : s.assigned.length === 0
                                  ? "Assign"
                                  : "Add"}
                            </button>
                            {!bulkMode && s.assigned.length === 0 ? (
                              <button
                                onClick={() => runRebook(s.eventId)}
                                disabled={isRebooking}
                                className="mono text-[9px] w-full rounded mt-1"
                                style={{
                                  letterSpacing: "0.06em",
                                  padding: "3px 0",
                                  color: "var(--spark-text-secondary)",
                                  background: "transparent",
                                  border: "1px solid var(--spark-border)",
                                  opacity: isRebooking && rebookingId === s.eventId ? 0.5 : 1,
                                }}
                                title="Book the crew who worked this venue last time"
                              >
                                {rebookingId === s.eventId ? "…" : "Last crew"}
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
              style={{ color: "var(--spark-text-meta)", letterSpacing: "0.08em" }}
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
                selected.size === 0 ? "rgba(var(--spark-ink-rgb),0.08)" : "var(--spark-lime)",
              color: selected.size === 0 ? "rgba(var(--spark-ink-rgb),0.4)" : "var(--spark-on-accent)",
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
    <div className="p-5 md:p-8 spark-scale">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="display text-2xl font-bold">Staffing Board</h1>
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            Who's on which shift this week. Tap a slot to assign.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            aria-label="Previous week"
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <span aria-hidden>‹</span>
            <span className="hidden sm:inline"> Prev</span>
          </button>
          <span
            className="mono text-[12px] px-2 whitespace-nowrap"
            style={{ letterSpacing: "0.06em", color: "var(--spark-text)" }}
          >
            {rangeLabel}
          </span>
          <button
            onClick={() => shift(1)}
            aria-label="Next week"
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <span className="hidden sm:inline">Next </span>
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      <Suspense
        fallback={
          <p
            className="p-10 text-center text-sm"
            style={{ color: "var(--spark-text-meta)" }}
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
