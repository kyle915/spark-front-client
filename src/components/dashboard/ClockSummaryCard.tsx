import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RefreshCw, User } from "lucide-react";
import { LiveShiftBoardQuery } from "@/api/queries/LiveShiftBoardQuery";
import type { LiveShiftBoardQuery as LiveShiftBoardQueryType } from "@api/queries/__generated__/LiveShiftBoardQuery.graphql";
import { PayrollTimesheetQuery } from "@/api/queries/PayrollTimesheetQuery";
import type { PayrollTimesheetQuery as PayrollTimesheetQueryType } from "@api/queries/__generated__/PayrollTimesheetQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { LeafTabs } from "@/motion/LeafTabs";
import BAProfileModal from "@/components/pages/talent/BAProfileModal";
import {
  AUTO_SYNC_INTERVAL_MS,
  formatElapsedSince,
  formatSyncAge,
} from "./clockSummaryHelpers";

/**
 * Who's working, and what it adds up to — on the dashboard rather than a click
 * away, with LeafTabs, live elapsed clock timers, clickable BA rows, and a
 * 60-second visibility-aware background refresh.
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
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

type Tab = "today" | "week";

const CLOCK_TAB_OPTIONS = [
  { key: "today" as const, label: "Today" },
  { key: "week" as const, label: "Pay week" },
] as const;

const ClockFrame: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  weekLabel: string;
  syncLabel: string;
  onRefresh: () => void;
  children: React.ReactNode;
}> = ({ tab, setTab, weekLabel, syncLabel, onRefresh, children }) => (
  <div className="spark-card p-5">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs m-0" style={{ color: "var(--spark-text-meta)" }}>
            Time clock
          </p>
          <span
            className="text-[11px] tab-num"
            style={{ color: "var(--spark-text-meta)" }}
          >
            · Last synced {syncLabel}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh live clock & timesheet"
            aria-label="Refresh time clock"
            className="p-1 rounded-md cursor-pointer transition hover:opacity-100 opacity-70"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--spark-text-meta)",
            }}
          >
            <RefreshCw size={11.5} strokeWidth={1.9} />
          </button>
        </div>
        <p
          className="text-[13px] mt-1 mb-0"
          style={{ color: "rgba(var(--spark-ink-rgb),0.55)" }}
        >
          {tab === "today"
            ? "Who's working right now · tap any BA to message or view profile"
            : `Hours this pay week · ${weekLabel}`}
        </p>
      </div>
      <LeafTabs
        ariaLabel="Time clock view"
        value={tab}
        onChange={setTab}
        options={CLOCK_TAB_OPTIONS}
      />
    </div>
    {children}
    <div className="mt-3.5 flex items-center justify-between gap-3">
      <Link
        to={tab === "today" ? "/live-board" : "/timesheet"}
        className="text-xs font-medium no-underline hover:underline"
        style={{ color: "var(--spark-lime)" }}
      >
        {tab === "today" ? "Open On the Clock →" : "Open Timesheet →"}
      </Link>
    </div>
  </div>
);

// ── Today ───────────────────────────────────────────────────────────────────
const TodayView: React.FC<{
  tenantId: string;
  fetchKey: number;
  nowMs: number;
  syncLabel: string;
  onRefresh: () => void;
  setTab: (t: Tab) => void;
  weekLabel: string;
  onOpenBa: (uuid: string, name: string) => void;
}> = ({
  tenantId,
  fetchKey,
  nowMs,
  syncLabel,
  onRefresh,
  setTab,
  weekLabel,
  onOpenBa,
}) => {
  const data = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const shifts = (data?.liveShiftBoard ?? []).filter(Boolean);

  const rows = shifts.flatMap((s) =>
    (s.assigned ?? []).filter(Boolean).map((a) => ({
      key: `${s.eventUuid}:${a!.ambassadorUuid}`,
      ambassadorUuid: String(a!.ambassadorUuid),
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
    <ClockFrame
      tab="today"
      setTab={setTab}
      weekLabel={weekLabel}
      syncLabel={syncLabel}
      onRefresh={onRefresh}
    >
      <p className="text-sm mt-3.5 mb-0" style={{ color: "var(--spark-text)" }}>
        {onClock.length} on the clock · {fmtHours(totalToday)} logged ·{" "}
        {notIn.length} not clocked in
      </p>
      <Rows>
        {[...onClock, ...done, ...notIn].slice(0, 8).map((r) => {
          const isLive = Boolean(r.clockInAt && !r.clockOutAt);
          const elapsed = isLive ? formatElapsedSince(r.clockInAt, nowMs) : "";
          const rightText = isLive
            ? `${elapsed ? `${elapsed} · ` : ""}in ${fmtClock(r.clockInAt)}`
            : r.clockOutAt
              ? `${fmtClock(r.clockInAt)}–${fmtClock(r.clockOutAt)} · ${fmtHours(r.hours)}`
              : "not clocked in";
          return (
            <Row
              key={r.key}
              name={r.name}
              sub={r.where}
              right={rightText}
              live={isLive}
              dim={!r.clockInAt}
              onClick={() => onOpenBa(r.ambassadorUuid, r.name)}
              title={`Open ${r.name} profile & DM`}
            />
          );
        })}
      </Rows>
      {rows.length > 8 ? (
        <p
          className="text-xs mt-2 mb-0"
          style={{ color: "rgba(var(--spark-ink-rgb),0.55)" }}
        >
          +{rows.length - 8} more on{" "}
          <Link to="/live-board" className="underline underline-offset-2">
            On the Clock
          </Link>
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
  fetchKey: number;
  syncLabel: string;
  onRefresh: () => void;
  setTab: (t: Tab) => void;
  weekLabel: string;
  onOpenBa: (uuid: string, name: string) => void;
}> = ({
  tenantId,
  start,
  end,
  fetchKey,
  syncLabel,
  onRefresh,
  setTab,
  weekLabel,
  onOpenBa,
}) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<PayrollTimesheetQueryType>(
    PayrollTimesheetQuery,
    { startDate: start, endDate: end, tenantId },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const sheet = data?.payrollTimesheet;
  const rows = (sheet?.rows ?? []).filter(Boolean);

  if (!rows.length) return null;

  const sorted = [...rows].sort(
    (a, b) => Number(b!.hours ?? 0) - Number(a!.hours ?? 0),
  );
  const needsReview = rows.filter((r) => r!.needsReview).length;

  return (
    <ClockFrame
      tab="week"
      setTab={setTab}
      weekLabel={weekLabel}
      syncLabel={syncLabel}
      onRefresh={onRefresh}
    >
      <p className="text-sm mt-3.5 mb-0" style={{ color: "var(--spark-text)" }}>
        {fmtHours(sheet?.totalHours)} total · {rows.length}{" "}
        {rows.length === 1 ? "BA" : "BAs"}
        {needsReview ? ` · ${needsReview} need review` : ""}
      </p>
      <Rows>
        {sorted.slice(0, 8).map((r) => {
          const displayName = r!.name || r!.email || "Unknown BA";
          const uuid = String(r!.ambassadorUuid);
          return (
            <Row
              key={uuid}
              name={displayName}
              sub={`${r!.shifts ?? 0} shift${Number(r!.shifts) === 1 ? "" : "s"}`}
              right={fmtHours(r!.hours)}
              warn={Boolean(r!.needsReview)}
              onClick={() =>
                navigate(`/timesheet?ba=${encodeURIComponent(uuid)}`)
              }
              title={`Open ${displayName} in Timesheet`}
              secondaryAction={{
                label: "Profile",
                onClick: () => onOpenBa(uuid, displayName),
              }}
            />
          );
        })}
      </Rows>
      {rows.length > 8 ? (
        <p
          className="text-xs mt-2 mb-0"
          style={{ color: "rgba(var(--spark-ink-rgb),0.55)" }}
        >
          +{rows.length - 8} more in{" "}
          <Link to="/timesheet" className="underline underline-offset-2">
            Timesheet
          </Link>
        </p>
      ) : null}
    </ClockFrame>
  );
};

// ── Bits ────────────────────────────────────────────────────────────────────
const Rows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-3.5 flex flex-col">{children}</div>
);

const Row: React.FC<{
  name: string;
  sub: string;
  right: string;
  live?: boolean;
  warn?: boolean;
  dim?: boolean;
  title?: string;
  onClick?: () => void;
  secondaryAction?: { label: string; onClick: () => void };
}> = ({
  name,
  sub,
  right,
  live,
  warn,
  dim,
  title,
  onClick,
  secondaryAction,
}) => (
  <div
    role="button"
    tabIndex={0}
    title={title}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    }}
    className="group flex items-center justify-between gap-3 py-2 px-1.5 -mx-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[rgba(var(--spark-ink-rgb),0.04)]"
    style={{
      borderTop: "1px solid var(--spark-border)",
      opacity: dim ? 0.6 : 1,
    }}
  >
    <div className="min-w-0">
      <div className="text-sm font-semibold flex items-center gap-1.5">
        {live ? <span className="spark-live-clock-dot" aria-hidden /> : null}
        <span className="truncate group-hover:underline underline-offset-2">
          {name}
        </span>
      </div>
      <div
        className="text-xs truncate"
        style={{ color: "rgba(var(--spark-ink-rgb),0.55)" }}
      >
        {sub}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {secondaryAction ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            secondaryAction.onClick();
          }}
          className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-opacity"
          style={{
            border: "1px solid var(--spark-border)",
            background: "var(--spark-surface)",
            color: "var(--spark-text)",
          }}
        >
          <User size={10.5} strokeWidth={1.9} />
          {secondaryAction.label}
        </button>
      ) : null}
      <div
        className="mono text-xs whitespace-nowrap tab-num"
        style={{
          color: live
            ? "var(--spark-lime)"
            : warn
              ? "#f0b429"
              : "rgba(var(--spark-ink-rgb),0.75)",
        }}
      >
        {right}
      </div>
    </div>
  </div>
);

// ── Card ────────────────────────────────────────────────────────────────────
const ClockSummaryCard: React.FC = () => {
  const { tenantId } = useAuthStore();
  const [tab, setTab] = useState<Tab>("today");
  const [fetchKey, setFetchKey] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [selectedBa, setSelectedBa] = useState<{
    uuid: string;
    name: string;
  } | null>(null);

  const triggerSync = useCallback(() => {
    const t = Date.now();
    setFetchKey((k) => k + 1);
    setLastSyncedAt(t);
    setNowMs(t);
  }, []);

  // 30s ticker so active elapsed durations ("2h 14m in") & sync age stay fresh.
  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => window.clearInterval(tick);
  }, []);

  // 60s visibility-aware background refresh for second-monitor ops boards.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    }, AUTO_SYNC_INTERVAL_MS);

    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastSyncedAt >= AUTO_SYNC_INTERVAL_MS
      ) {
        triggerSync();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [lastSyncedAt, triggerSync]);

  const { start, end, weekLabel } = useMemo(() => {
    const now = new Date();
    const mon = mondayOf(now);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const f = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return {
      start: ymd(mon),
      end: ymd(sun),
      weekLabel: `${f(mon)} – ${f(sun)}`,
    };
  }, []);

  if (!tenantId) return null;

  const syncLabel = formatSyncAge(lastSyncedAt, nowMs);

  return (
    <>
      <Suspense fallback={null}>
        {tab === "today" ? (
          <TodayView
            tenantId={tenantId}
            fetchKey={fetchKey}
            nowMs={nowMs}
            syncLabel={syncLabel}
            onRefresh={triggerSync}
            setTab={setTab}
            weekLabel={weekLabel}
            onOpenBa={(uuid, name) => setSelectedBa({ uuid, name })}
          />
        ) : (
          <WeekView
            tenantId={tenantId}
            start={start}
            end={end}
            fetchKey={fetchKey}
            syncLabel={syncLabel}
            onRefresh={triggerSync}
            setTab={setTab}
            weekLabel={weekLabel}
            onOpenBa={(uuid, name) => setSelectedBa({ uuid, name })}
          />
        )}
      </Suspense>

      {selectedBa ? (
        <BAProfileModal
          ambassadorUuid={selectedBa.uuid}
          fallbackName={selectedBa.name}
          onClose={() => setSelectedBa(null)}
        />
      ) : null}
    </>
  );
};

export default ClockSummaryCard;
