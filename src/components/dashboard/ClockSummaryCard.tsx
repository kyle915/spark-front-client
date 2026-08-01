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
 * Both are scoped to the active tenant, so this is Total Wireless' numbers
 * when Total Wireless is selected — nothing here is hardcoded to one client.
 *
 * No new backend: Today reads the same `liveShiftBoard` the On the Clock page
 * uses, Pay week the same `payrollTimesheet` behind Timesheet. Deliberate —
 * a summary that computes its own totals is a summary that will eventually
 * disagree with the page it summarises.
 */

const ymd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Monday of the week containing `d`, in local time. */
const mondayOf = (d: Date): Date => {
  const out = new Date(d);
  // getDay(): 0=Sun … 6=Sat. Sunday belongs to the week that just ended.
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

const card: React.CSSProperties = {};
const label: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
};
const muted = "rgba(255,255,255,0.55)";

// ── Today ───────────────────────────────────────────────────────────────────
const TodayView: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId },
    // Live board: always hit the network, a cached "who's on the clock" is
    // worse than a spinner.
    { fetchPolicy: "network-only" },
  );
  const shifts = (data?.liveShiftBoard ?? []).filter(Boolean);

  // Flatten to per-BA rows — the question is about people, not events.
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

  if (!rows.length) {
    return (
      <p style={{ fontSize: 13, color: muted, margin: "14px 0 0" }}>
        No shifts on the board today.
      </p>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 26, margin: "14px 0 4px", flexWrap: "wrap" }}>
        <Stat value={String(onClock.length)} unit="on the clock" live={onClock.length > 0} />
        <Stat value={fmtHours(totalToday)} unit="logged today" />
        {notIn.length ? <Stat value={String(notIn.length)} unit="not clocked in" warn /> : null}
      </div>
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
    </>
  );
};

// ── Pay week ────────────────────────────────────────────────────────────────
const WeekView: React.FC<{ tenantId: string; start: string; end: string }> = ({
  tenantId,
  start,
  end,
}) => {
  const data = useLazyLoadQuery<PayrollTimesheetQueryType>(
    PayrollTimesheetQuery,
    { startDate: start, endDate: end, tenantId },
    { fetchPolicy: "store-and-network" },
  );
  const sheet = data?.payrollTimesheet;
  const rows = (sheet?.rows ?? []).filter(Boolean);

  if (!rows.length) {
    return (
      <p style={{ fontSize: 13, color: muted, margin: "14px 0 0" }}>
        No hours logged this week yet.
      </p>
    );
  }

  const sorted = [...rows].sort((a, b) => Number(b!.hours ?? 0) - Number(a!.hours ?? 0));
  const needsReview = rows.filter((r) => r!.needsReview).length;

  return (
    <>
      <div style={{ display: "flex", gap: 26, margin: "14px 0 4px", flexWrap: "wrap" }}>
        <Stat value={fmtHours(sheet?.totalHours)} unit="total hours" />
        <Stat value={String(rows.length)} unit={rows.length === 1 ? "BA" : "BAs"} />
        {needsReview ? <Stat value={String(needsReview)} unit="need review" warn /> : null}
      </div>
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
    </>
  );
};

// ── Bits ────────────────────────────────────────────────────────────────────
const Stat: React.FC<{ value: string; unit: string; live?: boolean; warn?: boolean }> = ({
  value,
  unit,
  live,
  warn,
}) => (
  <div>
    <div
      style={{
        fontSize: 26,
        fontWeight: 800,
        lineHeight: 1.1,
        color: warn ? "#f0b429" : live ? "var(--spark-lime)" : "var(--spark-text)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {value}
      {live ? (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--spark-lime)",
            display: "inline-block",
          }}
        />
      ) : null}
    </div>
    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{unit}</div>
  </div>
);

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
        color: warn ? "#f0b429" : "rgba(255,255,255,0.75)",
      }}
    >
      {right}
    </div>
  </div>
);

// ── Card ────────────────────────────────────────────────────────────────────
const ClockSummaryCard: React.FC = () => {
  const { tenantId } = useAuthStore();
  const [tab, setTab] = useState<"today" | "week">("today");

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
        <div style={{ display: "flex", gap: 6 }}>
          {(["today", "week"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: tab === t ? "var(--spark-lime)" : "transparent",
                color: tab === t ? "#0a0d09" : "var(--spark-text)",
                border: tab === t ? "none" : "1px solid var(--spark-border)",
              }}
            >
              {t === "today" ? "Today" : "Pay week"}
            </button>
          ))}
        </div>
      </div>

      <div style={card}>
        {/* Each tab owns its Suspense so switching shows a small placeholder
            instead of blanking the whole card. */}
        <Suspense
          fallback={
            <p style={{ fontSize: 13, color: muted, margin: "14px 0 0" }}>Loading…</p>
          }
        >
          {tab === "today" ? (
            <TodayView tenantId={tenantId} />
          ) : (
            <WeekView tenantId={tenantId} start={start} end={end} />
          )}
        </Suspense>
      </div>

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
};

export default ClockSummaryCard;
