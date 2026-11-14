import { Suspense, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { LiveShiftBoardQuery } from "@/api/queries/LiveShiftBoardQuery";
import type { LiveShiftBoardQuery as LiveShiftBoardQueryType } from "@api/queries/__generated__/LiveShiftBoardQuery.graphql";
import { PayrollTimesheetQuery } from "@/api/queries/PayrollTimesheetQuery";
import type { PayrollTimesheetQuery as PayrollTimesheetQueryType } from "@api/queries/__generated__/PayrollTimesheetQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Who's working, and what it adds up to — on the dashboard rather than a click
 * away.
 *
 * Two questions, two tabs, because they're asked at different moments:
 *
 *   TODAY     — mid-day. Who is on the clock right this second, who's already
 *               finished, who never showed. Live clock state, so it answers
 *               "is my field team actually out there".
 *   PAY WEEK  — end of week. Hours per BA for the current Mon–Sun, which is
 *               what gets approved and paid.
 *
 * Empty boards render nothing — a "No shifts on the board" card is chrome
 * without a next action. The On the Clock / Timesheet pages still exist
 * in the sidebar when someone wants to look anyway.
 */

const ymd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Monday of the week containing `d`, in local time. */
const mondayOf = (d: Date): Date => {
  const out = new Date(d);
  const shift = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - shift);
  out.setHours(0, 0, 0, 0);
  return out;
};

const fmtHours = (h: number | null | undefined): string => {
  const n = Number(h ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0h";
  const whole = Math.floor(n);
  const mins = Math.round((n - whole) * 60);
  return mins ? `${whole}h ${String(mins).padStart(2, "0")}m` : `${whole}h`;
};

const fmtClock = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "var(--spark-text-meta)",
};
const muted = "rgba(var(--spark-ink-rgb),0.55)";

type Tab = "today" | "week";

const ClockFrame: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  weekLabel: string;
  children: React.ReactNode;
}> = ({ tab, setTab, weekLabel, children }) => (
  <div className="spark-card p-5">
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <p style={{ ...label, margin: 0 }}>Time clock</p>
        <p style={{ fontSize: 13, color: muted, margin: "4px 0 0" }}>
          {tab === "today"
            ? "Who's working right now"
            : `Hours this pay week · ${weekLabel}`}
        </p>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {(["today", "week"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="text-sm"
            style={{
              background: "transparent",
              color: tab === t ? "var(--spark-text)" : "rgba(var(--spark-ink-rgb),0.45)",
              border: "none",
              fontWeight: tab === t ? 600 : 500,
              padding: 0,
              textDecoration: tab === t ? "underline" : "none",
              textUnderlineOffset: 4,
            }}
          >
            {t === "today" ? "Today" : "Pay week"}
          </button>
        ))}
      </div>
    </div>
    {children}
    <div style={{ marginTop: 14, display: "flex", gap: 14 }}>
      <Link
        to={tab === "today" ? "/live-board" : "/timesheet"}
        style={{ fontSize: 12, color: "var(--spark-lime)", textDecoration: "none" }}
      >
        {tab === "today" ? "Open On the Clock →" : "Open Timesheet →"}
      </Link>
    </div>
  </div>
);

// ── Today ───────────────────────────────────────────────────────────────────
const TodayView: React.FC<{
  tenantId: string;
  setTab: (t: Tab) => void;
  weekLabel: string;
}> = ({ tenantId, setTab, weekLabel }) => {
  const data = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const shifts = (data?.liveShiftBoard ?? []).filter(Boolean);

  const rows = shifts.flatMap((s) =>
    (s.assigned ?? []).filter(Boolean).map((a) => ({
      key: `${s.eventUuid}:${a!.ambassadorUuid}`,
      name: a!.name || "Unknown BA",
      where: s.store || s.eventName || "—",
      status: (a!.status || "").toLowerCase(),
      clockInAt: a!.clockInAt,
      clockOutAt: a!.clockOutAt,
      hours: a!.workedHours,
    })),
  );
  const onClock = rows.filter((r) => r.clockInAt && !r.clockOutAt);
  const done = rows.filter((r) => r.clockOutAt);
  const notIn = rows.filter((r) => !r.clockInAt);
  const totalToday = done.reduce((sum, r) => sum + Number(r.hours ?? 0), 0);

  if (!rows.length) return null;

  return (
    <ClockFrame tab="today" setTab={setTab} weekLabel={weekLabel}>
      <p style={{ fontSize: 14, color: "var(--spark-text)", margin: "14px 0 0" }}>
        {onClock.length} on the clock · {fmtHours(totalToday)} logged · {notIn.length}{" "}
        not clocked in
      </p>
      <Rows>
        {[...onClock, ...done, ...notIn].slice(0, 8).map((r) => (
          <Row
            key={r.key}
            name={r.name}
            sub={r.where}
            right={
              r.clockInAt && !r.clockOutAt
                ? `in ${fmtClock(r.clockInAt)}`
                : r.clockOutAt
                  ? `${fmtClock(r.clockInAt)}–${fmtClock(r.clockOutAt)} · ${fmtHours(r.hours)}`
                  : "not clocked in"
            }
            live={Boolean(r.clockInAt && !r.clockOutAt)}
            dim={!r.clockInAt}
          />
        ))}
      </Rows>
      {rows.length > 8 ? (
        <p style={{ fontSize: 12, color: muted, marginTop: 8 }}>
          +{rows.length - 8} more
        </p>
      ) : null}
    </ClockFrame>
  );
};

// ── Pay week ────────────────────────────────────────────────────────────────
const WeekView: React.FC<{
  tenantId: string;
  start: string;
  end: string;
  setTab: (t: Tab) => void;
  weekLabel: string;
}> = ({ tenantId, start, end, setTab, weekLabel }) => {
  const data = useLazyLoadQuery<PayrollTimesheetQueryType>(
    PayrollTimesheetQuery,
    { startDate: start, endDate: end, tenantId },
    { fetchPolicy: "store-and-network" },
  );
  const sheet = data?.payrollTimesheet;
  const rows = (sheet?.rows ?? []).filter(Boolean);

  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => Number(b!.hours ?? 0) - Number(a!.hours ?? 0));
  const needsReview = rows.filter((r) => r!.needsReview).length;

  return (
    <ClockFrame tab="week" setTab={setTab} weekLabel={weekLabel}>
      <p style={{ fontSize: 14, color: "var(--spark-text)", margin: "14px 0 0" }}>
        {fmtHours(sheet?.totalHours)} total · {rows.length}{" "}
        {rows.length === 1 ? "BA" : "BAs"}
        {needsReview ? ` · ${needsReview} need review` : ""}
      </p>
      <Rows>
        {sorted.slice(0, 8).map((r) => (
          <Row
            key={r!.ambassadorUuid}
            name={r!.name || r!.email || "Unknown BA"}
            sub={`${r!.shifts ?? 0} shift${Number(r!.shifts) === 1 ? "" : "s"}`}
            right={fmtHours(r!.hours)}
            warn={Boolean(r!.needsReview)}
          />
        ))}
      </Rows>
      {rows.length > 8 ? (
        <p style={{ fontSize: 12, color: muted, marginTop: 8 }}>
          +{rows.length - 8} more
        </p>
      ) : null}
    </ClockFrame>
  );
};

// ── Bits ────────────────────────────────────────────────────────────────────
const Rows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>{children}</div>
);

const Row: React.FC<{
  name: string;
  sub: string;
  right: string;
  live?: boolean;
  warn?: boolean;
  dim?: boolean;
}> = ({ name, sub, right, live, warn, dim }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "8px 0",
      borderTop: "1px solid var(--spark-border)",
      opacity: dim ? 0.55 : 1,
    }}
  >
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
        {live ? (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "var(--spark-lime)",
              flexShrink: 0,
            }}
          />
        ) : null}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: muted,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {sub}
      </div>
    </div>
    <div
      className="mono"
      style={{
        fontSize: 12,
        whiteSpace: "nowrap",
        color: warn ? "#f0b429" : "rgba(var(--spark-ink-rgb),0.75)",
      }}
    >
      {right}
    </div>
  </div>
);

// ── Card ────────────────────────────────────────────────────────────────────
const ClockSummaryCard: React.FC = () => {
  const { tenantId } = useAuthStore();
  const [tab, setTab] = useState<Tab>("today");

  const { start, end, weekLabel } = useMemo(() => {
    const now = new Date();
    const mon = mondayOf(now);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const f = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { start: ymd(mon), end: ymd(sun), weekLabel: `${f(mon)} – ${f(sun)}` };
  }, []);

  if (!tenantId) return null;

  return (
    <Suspense fallback={null}>
      {tab === "today" ? (
        <TodayView tenantId={tenantId} setTab={setTab} weekLabel={weekLabel} />
      ) : (
        <WeekView
          tenantId={tenantId}
          start={start}
          end={end}
          setTab={setTab}
          weekLabel={weekLabel}
        />
      )}
    </Suspense>
  );
};

export default ClockSummaryCard;
