import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { CheckCircle2, Eye, MessageSquare, UserPlus } from "lucide-react";
import { LiveShiftBoardQuery } from "@/api/queries/LiveShiftBoardQuery";
import type { LiveShiftBoardQuery as LiveShiftBoardQueryType } from "@api/queries/__generated__/LiveShiftBoardQuery.graphql";
import { useRequestAttentionCounts } from "@/components/pages/dashboard-event/AttentionEngine";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { SheetShiftsQuery } from "@/api/queries/SheetShiftsQuery";
import type { SheetShiftsQuery as SheetShiftsQueryType } from "@api/queries/__generated__/SheetShiftsQuery.graphql";
import SparkSheet from "@/shared/SparkSheet";
import BAProfileModal from "@/components/pages/talent/BAProfileModal";
import InviteBAModal from "@/requests/InviteBAModal";
import EventQuickPeekSheet from "./EventQuickPeekSheet";
import { fetchEventPeekDetail, type EventPeekDetail } from "./eventPeekClient";
import { sheetRows } from "./sheetStaffing";
import {
  attentionRows,
  startsTodayRows,
  type AttentionRow,
  type BoardShift,
  type StartsTodayRow,
} from "./todayAttention";

/**
 * The dashboard's first read: what starts today, beside what needs someone.
 *
 * Staff see both panels, built from the live shift board, with inline hover /
 * keyboard-focus quick actions (Nudge BA, Assign BA, Peek Event) and a
 * slide-over "Show all" drawer when >6 items need attention. Brand users see
 * only their request queues — ambassador names and clock state stay with Ignite.
 */

const SHOWN = 6;

const ymd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const toShifts = (
  data: LiveShiftBoardQueryType["response"] | null | undefined,
): BoardShift[] =>
  (data?.liveShiftBoard ?? [])
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      eventUuid: String(row.eventUuid),
      eventName: row.eventName ?? "",
      brandName: row.brandName ?? "",
      store: row.store ?? "",
      // Venue wall-clock when the server sends it; the instant otherwise.
      startTime: row.startLocal ?? row.startTime ?? "",
      endTime: row.endLocal ?? row.endTime ?? "",
      startInstant: row.startTime ?? null,
      lastClockInTapAt: row.lastClockInTapAt ?? null,
      assigned: (row.assigned ?? [])
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({
          ambassadorUuid: String(a.ambassadorUuid),
          name: a.name ?? "",
          status: (a.status ?? "").toLowerCase(),
          clockInAt: a.clockInAt ?? null,
          clockOutAt: a.clockOutAt ?? null,
          pendingApproval: Boolean(a.pendingApproval),
          registeredAt: a.registeredAt ?? null,
        })),
    }));

const Panel: React.FC<{
  title: string;
  count: number;
  link?: { to: string; label: string };
  children: React.ReactNode;
}> = ({ title, count, link, children }) => (
  <section className="spark-card spark-panel" aria-label={title}>
    <div className="spark-panel-head">
      <h2 className="spark-panel-title">
        {title}
        {count > 0 ? <span className="spark-panel-count">{count}</span> : null}
      </h2>
      {link ? (
        <Link to={link.to} className="spark-panel-link">
          {link.label}
        </Link>
      ) : null}
    </div>
    {children}
  </section>
);

const More: React.FC<{ hidden: number; to: string; noun: string }> = ({
  hidden,
  to,
  noun,
}) =>
  hidden > 0 ? (
    <Link to={to} className="spark-panel-row spark-panel-more">
      {hidden} more {noun}
    </Link>
  ) : null;

const quickActionBtnStyle: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-surface)",
  color: "var(--spark-text)",
};

const quickActionLimeStyle: React.CSSProperties = {
  border: "1px solid var(--spark-lime)",
  background: "rgba(var(--spark-accent-rgb), 0.14)",
  color: "var(--spark-text)",
};

const StartsToday: React.FC<{
  rows: StartsTodayRow[];
  onNudgeBa?: (ambassadorUuid: string, name?: string) => void;
  onAssignEvent?: (eventUuid: string) => void;
  onPeekEvent?: (eventUuid: string) => void;
}> = ({ rows, onNudgeBa, onAssignEvent, onPeekEvent }) => {
  const navigate = useNavigate();
  return (
    <Panel
      title="Starts today"
      count={rows.length}
      link={{ to: "/today", label: "Open Today" }}
    >
      {rows.length === 0 ? (
        <p className="spark-panel-empty">
          Nothing on the board today.{" "}
          <Link to="/upcoming">See upcoming events</Link>
        </p>
      ) : (
        <>
          {rows.slice(0, SHOWN).map((r) => {
            const eventUuid = r.eventUuid ?? r.key;
            const canAssign = Boolean(r.unbooked && onAssignEvent);
            const canNudge = Boolean(
              !r.unbooked && r.primaryAmbassadorUuid && onNudgeBa,
            );
            const canPeek = Boolean(eventUuid && onPeekEvent);
            return (
              <div
                key={r.key}
                role="link"
                tabIndex={0}
                onClick={() => navigate(r.to)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(r.to);
                  }
                }}
                className="spark-panel-row group cursor-pointer"
              >
                <span className="spark-panel-row-main">
                  <span className="spark-panel-row-title">{r.title}</span>
                  <span
                    className={`spark-panel-row-sub${r.flagged ? " is-flagged" : ""}`}
                  >
                    {r.detail}
                  </span>
                </span>
                <span className="inline-flex items-center justify-end gap-1.5">
                  {(canAssign || canNudge || canPeek) && (
                    <span
                      className="hidden sm:inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canAssign ? (
                        <button
                          type="button"
                          onClick={() => onAssignEvent?.(eventUuid)}
                          title="Assign an ambassador right from the dashboard"
                          className="px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          style={quickActionLimeStyle}
                        >
                          <UserPlus size={11} strokeWidth={2} />
                          Assign BA
                        </button>
                      ) : null}
                      {canNudge && r.primaryAmbassadorUuid ? (
                        <button
                          type="button"
                          onClick={() =>
                            onNudgeBa?.(
                              r.primaryAmbassadorUuid!,
                              r.primaryAmbassadorName ?? undefined,
                            )
                          }
                          title="Open 1:1 DM thread with this ambassador"
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                          style={quickActionBtnStyle}
                        >
                          <MessageSquare size={11} strokeWidth={1.9} />
                          Nudge
                        </button>
                      ) : null}
                      {canPeek ? (
                        <button
                          type="button"
                          onClick={() => onPeekEvent?.(eventUuid)}
                          title="Peek shift details without leaving the dashboard"
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                          style={quickActionBtnStyle}
                        >
                          <Eye size={11} strokeWidth={1.9} />
                          Peek
                        </button>
                      ) : null}
                    </span>
                  )}
                  <span className="spark-panel-row-aside">
                    {r.time || "No time set"}
                  </span>
                </span>
              </div>
            );
          })}
          <More
            hidden={rows.length - SHOWN}
            to="/today"
            noun={rows.length - SHOWN === 1 ? "event" : "events"}
          />
        </>
      )}
    </Panel>
  );
};

const AttentionRowItem: React.FC<{
  row: AttentionRow;
  staff: boolean;
  onNudgeBa?: (ambassadorUuid: string, name?: string) => void;
  onAssignEvent?: (eventUuid: string) => void;
  onPeekEvent?: (eventUuid: string) => void;
  onAfterNavigate?: () => void;
}> = ({
  row: r,
  staff,
  onNudgeBa,
  onAssignEvent,
  onPeekEvent,
  onAfterNavigate,
}) => {
  const navigate = useNavigate();
  const canNudge = Boolean(staff && r.ambassadorUuid && onNudgeBa);
  const canAssign = Boolean(
    staff &&
      r.eventUuid &&
      (r.kind === "unbooked" || r.kind === "no_show") &&
      onAssignEvent,
  );
  const canPeek = Boolean(staff && r.eventUuid && onPeekEvent);

  const openTarget = () => {
    onAfterNavigate?.();
    navigate(r.to);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openTarget}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTarget();
        }
      }}
      className="spark-panel-row spark-panel-row--reason group cursor-pointer"
    >
      <span className="spark-panel-row-main">
        <span className="spark-panel-row-title">{r.subject}</span>
        {r.context ? (
          <span className="spark-panel-row-sub">{r.context}</span>
        ) : null}
      </span>
      <span className="inline-flex items-center justify-end gap-1.5 flex-wrap">
        {(canNudge || canAssign || canPeek) && (
          <span
            className="inline-flex sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 items-center gap-1 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {canNudge && r.ambassadorUuid ? (
              <button
                type="button"
                onClick={() => onNudgeBa?.(r.ambassadorUuid!, r.subject)}
                title="Open 1:1 DM thread to nudge this ambassador"
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                style={quickActionBtnStyle}
              >
                <MessageSquare size={11} strokeWidth={1.9} />
                Nudge BA
              </button>
            ) : null}
            {canAssign && r.eventUuid ? (
              <button
                type="button"
                onClick={() => onAssignEvent?.(r.eventUuid!)}
                title="Assign an ambassador right from the dashboard"
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                style={quickActionLimeStyle}
              >
                <UserPlus size={11} strokeWidth={2} />
                Assign BA
              </button>
            ) : null}
            {canPeek && r.eventUuid ? (
              <button
                type="button"
                onClick={() => onPeekEvent?.(r.eventUuid!)}
                title="Peek shift details"
                className="px-2 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                style={quickActionBtnStyle}
              >
                <Eye size={11} strokeWidth={1.9} />
                Peek
              </button>
            ) : null}
          </span>
        )}
        <span className="spark-panel-row-aside is-flagged">{r.reason}</span>
      </span>
    </div>
  );
};

const NeedsAttention: React.FC<{
  rows: AttentionRow[];
  staff?: boolean;
  onNudgeBa?: (ambassadorUuid: string, name?: string) => void;
  onAssignEvent?: (eventUuid: string) => void;
  onPeekEvent?: (eventUuid: string) => void;
}> = ({
  rows,
  staff = false,
  onNudgeBa,
  onAssignEvent,
  onPeekEvent,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hiddenCount = rows.length - SHOWN;

  return (
    <>
      <Panel
        title="Needs attention"
        count={rows.length}
        link={staff ? { to: "/live-board", label: "Live board" } : undefined}
      >
        {rows.length === 0 ? (
          <p className="spark-panel-empty">Nothing needs you right now.</p>
        ) : (
          <>
            {rows.slice(0, SHOWN).map((r) => (
              <AttentionRowItem
                key={r.key}
                row={r}
                staff={staff}
                onNudgeBa={onNudgeBa}
                onAssignEvent={onAssignEvent}
                onPeekEvent={onPeekEvent}
              />
            ))}
            {hiddenCount > 0 ? (
              <div className="spark-panel-row spark-panel-more flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="text-xs font-semibold underline underline-offset-2 cursor-pointer text-left"
                  style={{
                    color: "var(--spark-text)",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                >
                  Show all {rows.length} items (+{hiddenCount} more)
                </button>
                {staff ? (
                  <Link
                    to="/today"
                    className="text-xs no-underline hover:underline"
                    style={{ color: "var(--spark-text-secondary)" }}
                  >
                    Open Today →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <SparkSheet
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="right"
        eyebrow="Ops triage queue"
        title={`Needs attention · ${rows.length}`}
      >
        <div className="space-y-4">
          <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            Triage open punches, missed check-ins, and unbooked shifts inline
            without leaving the dashboard.
          </p>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: "1px solid var(--spark-border)",
              background: "var(--spark-surface)",
            }}
          >
            {rows.map((r) => (
              <AttentionRowItem
                key={r.key}
                row={r}
                staff={staff}
                onNudgeBa={onNudgeBa}
                onAssignEvent={onAssignEvent}
                onPeekEvent={(uuid) => {
                  setDrawerOpen(false);
                  onPeekEvent?.(uuid);
                }}
                onAfterNavigate={() => setDrawerOpen(false)}
              />
            ))}
          </div>
          {staff ? (
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <Link
                to="/live-board"
                onClick={() => setDrawerOpen(false)}
                className="font-semibold no-underline hover:underline"
                style={{ color: "var(--spark-lime)" }}
              >
                Open On the Clock →
              </Link>
              <Link
                to="/schedule?filter=unstaffed"
                onClick={() => setDrawerOpen(false)}
                className="font-medium no-underline hover:underline"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Unstaffed shifts →
              </Link>
            </div>
          ) : null}
        </div>
      </SparkSheet>
    </>
  );
};

/**
 * Who the Google staffing sheets have on today's shifts, and whether Spark's
 * booking agrees. Spark only reads the sheets; each row opens its sheet row.
 * Renders nothing when the sheets have nobody on today.
 */
export const OnTheSheets: React.FC<{ tenantId: string | null }> = ({
  tenantId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const data = useLazyLoadQuery<SheetShiftsQueryType>(
    SheetShiftsQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );
  const rows = useMemo(
    () => sheetRows(data?.sheetShifts ?? [], { showBrand: !tenantId }),
    [data, tenantId],
  );
  if (rows.length === 0) return null;
  const SHEET_SHOWN = 8;
  const shownRows = expanded ? rows : rows.slice(0, SHEET_SHOWN);
  return (
    <Panel title="On the sheets today" count={rows.length}>
      {shownRows.map((r) => (
        <a
          key={r.key}
          href={r.href}
          target="_blank"
          rel="noopener noreferrer"
          className="spark-panel-row spark-panel-row--reason"
          title="Open this row in the sheet"
        >
          <span className="spark-panel-row-main">
            <span className="spark-panel-row-title">{r.title}</span>
            <span className="spark-panel-row-sub">{r.detail}</span>
          </span>
          <span
            className={`spark-panel-row-aside${r.flagged ? " is-flagged" : ""}`}
          >
            {r.verdict}
          </span>
        </a>
      ))}
      {rows.length > SHEET_SHOWN ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="spark-panel-row spark-panel-more w-full text-left cursor-pointer"
          style={{ background: "transparent", borderLeft: "none", borderRight: "none", borderBottom: "none" }}
        >
          {expanded
            ? "Show fewer sheet rows"
            : `Show ${rows.length - SHEET_SHOWN} more on the sheets`}
        </button>
      ) : null}
    </Panel>
  );
};

const StaffPanels: React.FC<{ tenantId: string | null }> = ({ tenantId }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nudgeTarget, setNudgeTarget] = useState<{
    uuid: string;
    name?: string;
  } | null>(null);
  const [peekEventUuid, setPeekEventUuid] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<EventPeekDetail | null>(
    null,
  );

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return ymd(d);
  }, []);
  const todayData = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const yesterdayData = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId, date: yesterday },
    { fetchPolicy: "store-or-network", fetchKey: refreshKey },
  );
  const requests = useRequestAttentionCounts(tenantId);

  const today = useMemo(() => toShifts(todayData), [todayData]);
  const yesterdayShifts = useMemo(
    () => toShifts(yesterdayData),
    [yesterdayData],
  );
  const allKnownShifts = useMemo(
    () => [...today, ...yesterdayShifts],
    [today, yesterdayShifts],
  );

  const starts = useMemo(
    () => startsTodayRows(today, { showBrand: !tenantId }),
    [today, tenantId],
  );
  const needs = useMemo(
    () =>
      attentionRows({
        today,
        yesterday: yesterdayShifts,
        staleRequests: requests.stale,
        unscheduledRequests: requests.unscheduled,
      }),
    [today, yesterdayShifts, requests.stale, requests.unscheduled],
  );

  const openAssignByEventUuid = useCallback(
    async (eventUuid: string) => {
      try {
        const detail = await fetchEventPeekDetail(eventUuid);
        if (!detail) {
          showAlert("Couldn't load shift details for assignment.", "error");
          return;
        }
        setAssignTarget(detail);
      } catch {
        showAlert("Couldn't load shift details for assignment.", "error");
      }
    },
    [showAlert],
  );

  const peekShift = useMemo(
    () =>
      peekEventUuid
        ? (allKnownShifts.find((s) => s.eventUuid === peekEventUuid) ?? null)
        : null,
    [allKnownShifts, peekEventUuid],
  );

  if (starts.length === 0 && needs.length === 0) return null;

  return (
    <>
      {needs.length === 0 ? (
        <div className="space-y-2.5">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: "var(--spark-ok-bg)",
              color: "var(--spark-ok-ink)",
              border: "1px solid var(--spark-ok-border)",
            }}
          >
            <CheckCircle2 size={13} strokeWidth={1.75} />
            Recaps &amp; clock-ins clear
          </div>
          <StartsToday
            rows={starts}
            onNudgeBa={(uuid, name) => setNudgeTarget({ uuid, name })}
            onAssignEvent={(uuid) => void openAssignByEventUuid(uuid)}
            onPeekEvent={(uuid) => setPeekEventUuid(uuid)}
          />
        </div>
      ) : (
        <div className="spark-twin">
          <StartsToday
            rows={starts}
            onNudgeBa={(uuid, name) => setNudgeTarget({ uuid, name })}
            onAssignEvent={(uuid) => void openAssignByEventUuid(uuid)}
            onPeekEvent={(uuid) => setPeekEventUuid(uuid)}
          />
          <NeedsAttention
            rows={needs}
            staff
            onNudgeBa={(uuid, name) => setNudgeTarget({ uuid, name })}
            onAssignEvent={(uuid) => void openAssignByEventUuid(uuid)}
            onPeekEvent={(uuid) => setPeekEventUuid(uuid)}
          />
        </div>
      )}

      <EventQuickPeekSheet
        open={peekEventUuid !== null}
        onOpenChange={(next) => {
          if (!next) setPeekEventUuid(null);
        }}
        shift={peekShift}
        eventUuid={peekEventUuid}
        onNudgeBa={(uuid, name) => setNudgeTarget({ uuid, name })}
        onAssignBa={(detail) => {
          setPeekEventUuid(null);
          setAssignTarget(detail);
        }}
      />

      {assignTarget ? (
        <InviteBAModal
          eventId={assignTarget.id}
          eventDate={assignTarget.date}
          eventAddress={assignTarget.address}
          onClose={() => setAssignTarget(null)}
          onInvited={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : null}

      {nudgeTarget ? (
        <BAProfileModal
          ambassadorUuid={nudgeTarget.uuid}
          fallbackName={nudgeTarget.name}
          autoOpenDm
          onClose={() => setNudgeTarget(null)}
        />
      ) : null}
    </>
  );
};

const ClientPanel: React.FC<{ tenantId: string | null }> = ({ tenantId }) => {
  const requests = useRequestAttentionCounts(tenantId);
  const needs = attentionRows({
    today: [],
    yesterday: [],
    staleRequests: requests.stale,
    unscheduledRequests: requests.unscheduled,
  });
  if (needs.length === 0) return null;
  return <NeedsAttention rows={needs} />;
};

const TodayAttentionPanels: React.FC<{ staff: boolean }> = ({ staff }) => {
  const { tenantId } = useAuthStore();
  return staff ? (
    <StaffPanels tenantId={tenantId || null} />
  ) : (
    <ClientPanel tenantId={tenantId || null} />
  );
};

export default TodayAttentionPanels;
