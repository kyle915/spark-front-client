import { useMemo } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { LiveShiftBoardQuery } from "@/api/queries/LiveShiftBoardQuery";
import type { LiveShiftBoardQuery as LiveShiftBoardQueryType } from "@api/queries/__generated__/LiveShiftBoardQuery.graphql";
import { useRequestAttentionCounts } from "@/components/pages/dashboard-event/AttentionEngine";
import { useAuthStore } from "@/store/authStore";
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
 * Staff see both panels, built from the live shift board. Brand users see
 * only their request queues — ambassador names and clock state stay with
 * Ignite. A panel with nothing to say gives one quiet line; when neither
 * has anything, the whole block stays out of the way.
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
      startTime: row.startTime ?? "",
      endTime: row.endTime ?? "",
      assigned: (row.assigned ?? [])
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({
          ambassadorUuid: String(a.ambassadorUuid),
          name: a.name ?? "",
          status: (a.status ?? "").toLowerCase(),
          clockInAt: a.clockInAt ?? null,
          clockOutAt: a.clockOutAt ?? null,
          pendingApproval: Boolean(a.pendingApproval),
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

const StartsToday: React.FC<{ rows: StartsTodayRow[] }> = ({ rows }) => (
  <Panel
    title="Starts today"
    count={rows.length}
    link={{ to: "/today", label: "Open Today" }}
  >
    {rows.length === 0 ? (
      <p className="spark-panel-empty">
        Nothing on the board today. <Link to="/upcoming">See upcoming events</Link>
      </p>
    ) : (
      <>
        {rows.slice(0, SHOWN).map((r) => (
          <Link key={r.key} to={r.to} className="spark-panel-row">
            <span className="spark-panel-row-main">
              <span className="spark-panel-row-title">{r.title}</span>
              <span
                className={`spark-panel-row-sub${r.flagged ? " is-flagged" : ""}`}
              >
                {r.detail}
              </span>
            </span>
            <span className="spark-panel-row-aside">{r.time || "No time set"}</span>
          </Link>
        ))}
        <More
          hidden={rows.length - SHOWN}
          to="/today"
          noun={rows.length - SHOWN === 1 ? "event" : "events"}
        />
      </>
    )}
  </Panel>
);

const NeedsAttention: React.FC<{ rows: AttentionRow[] }> = ({ rows }) => (
  <Panel title="Needs attention" count={rows.length}>
    {rows.length === 0 ? (
      <p className="spark-panel-empty">Nothing needs you right now.</p>
    ) : (
      <>
        {rows.slice(0, SHOWN).map((r) => (
          <Link
            key={r.key}
            to={r.to}
            className="spark-panel-row spark-panel-row--reason"
          >
            <span className="spark-panel-row-main">
              <span className="spark-panel-row-title">{r.subject}</span>
              {r.context ? (
                <span className="spark-panel-row-sub">{r.context}</span>
              ) : null}
            </span>
            <span className="spark-panel-row-aside is-flagged">{r.reason}</span>
          </Link>
        ))}
        {rows.length > SHOWN ? (
          <p className="spark-panel-empty">
            {rows.length - SHOWN} more not shown.
          </p>
        ) : null}
      </>
    )}
  </Panel>
);

const StaffPanels: React.FC<{ tenantId: string | null }> = ({ tenantId }) => {
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return ymd(d);
  }, []);
  const todayData = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );
  const yesterdayData = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId, date: yesterday },
    { fetchPolicy: "store-or-network" },
  );
  const requests = useRequestAttentionCounts(tenantId);

  const today = useMemo(() => toShifts(todayData), [todayData]);
  const starts = useMemo(
    () => startsTodayRows(today, { showBrand: !tenantId }),
    [today, tenantId],
  );
  const needs = useMemo(
    () =>
      attentionRows({
        today,
        yesterday: toShifts(yesterdayData),
        staleRequests: requests.stale,
        unscheduledRequests: requests.unscheduled,
      }),
    [today, yesterdayData, requests.stale, requests.unscheduled],
  );

  if (starts.length === 0 && needs.length === 0) return null;
  return (
    <div className="spark-twin">
      <StartsToday rows={starts} />
      <NeedsAttention rows={needs} />
    </div>
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
