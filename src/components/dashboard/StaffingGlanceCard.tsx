import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link, useNavigate } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { StaffingBoardQuery } from "@/api/queries/StaffingBoardQuery";
import type { StaffingBoardQuery as StaffingBoardQueryType } from "@api/queries/__generated__/StaffingBoardQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { TideProgress } from "@/motion/PlanAndTideMoments";
import { buildSevenDayStaffingSummary } from "./staffingGlanceHelpers";

const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Staffing at a glance for the selected client: TideProgress fill ratio,
 * deep-linked Shifts Today & Unstaffed tiles (`/schedule?filter=unstaffed`),
 * and a 7-day day-by-day pill strip so RMMs spot short-staffed days instantly.
 */
export const StaffingGlanceCard: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const { startDate, endDate } = useMemo(() => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { startDate: ymd(start), endDate: ymd(end) };
  }, []);
  const data = useLazyLoadQuery<StaffingBoardQueryType>(
    StaffingBoardQuery,
    { startDate, endDate, tenantId: tenantId || null },
    { fetchPolicy: "store-and-network" },
  );
  const shifts = useMemo(
    () => (data?.staffingBoard ?? []).filter(Boolean),
    [data],
  );
  const summary = useMemo(
    () => buildSevenDayStaffingSummary(startDate, shifts),
    [startDate, shifts],
  );

  if (shifts.length === 0) return null;

  const todayBucket = summary.days[0];
  const todayCount = todayBucket?.total ?? 0;
  const unstaffedToday = todayBucket?.unstaffed ?? 0;
  const unstaffed = summary.unstaffedShifts;

  if (unstaffed === 0 && unstaffedToday === 0) {
    return (
      <button
        type="button"
        onClick={() => navigate("/schedule")}
        className="spark-card px-4 py-3.5 text-left w-full space-y-2.5 cursor-pointer transition hover:opacity-95"
        title="Open the Staffing Board"
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-2 text-xs font-medium"
            style={{ color: "var(--spark-ok-ink)" }}
          >
            <CheckCircle2 size={15} strokeWidth={1.75} className="shrink-0" />
            <span>
              100% staffed · All {shifts.length.toLocaleString()} shift
              {shifts.length === 1 ? "" : "s"} covered over the next 7 days
              {todayCount > 0 ? ` · ${todayCount} today` : ""}
            </span>
          </span>
          <ArrowRight
            size={14}
            strokeWidth={1.75}
            style={{ color: "var(--spark-text-meta)" }}
          />
        </div>
        <TideProgress
          percent={100}
          barColor="var(--spark-lime)"
          height={5}
          ariaLabel="7-day staffing fill rate"
        />
      </button>
    );
  }

  return (
    <section
      aria-label="Staffing at a glance"
      className="spark-card spark-stat-band space-y-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="spark-kpi-label">Staffing · next 7 days</p>
        <span
          className="text-xs font-semibold tab-num"
          style={{
            color:
              summary.fillPct >= 85
                ? "var(--spark-lime)"
                : "var(--spark-orange)",
          }}
        >
          {summary.fillPct}% staffed ({summary.staffedShifts}/{summary.totalShifts})
        </span>
      </div>

      <TideProgress
        percent={summary.fillPct}
        barColor={unstaffed > 0 ? "var(--spark-orange)" : "var(--spark-lime)"}
        height={6}
        ariaLabel="7-day staffing fill rate"
      />

      <div className="grid grid-cols-2 gap-3">
        <Link
          to={
            unstaffedToday > 0
              ? `/schedule?filter=unstaffed&date=${startDate}`
              : `/schedule?date=${startDate}`
          }
          className="rounded-xl p-2.5 -m-1 no-underline transition hover:bg-[rgba(var(--spark-ink-rgb),0.04)]"
          title="Open today's shifts on the Staffing Board"
        >
          <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
            Shifts today
          </p>
          <p
            className="tab-num text-2xl sm:text-3xl font-bold"
            style={{
              color:
                unstaffedToday > 0 ? "var(--spark-orange)" : "var(--spark-text)",
            }}
          >
            {todayCount.toLocaleString()}
          </p>
          <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            {unstaffedToday > 0 ? `${unstaffedToday} unstaffed →` : "All staffed"}
          </p>
        </Link>

        <Link
          to="/schedule?filter=unstaffed"
          className="rounded-xl p-2.5 -m-1 no-underline transition hover:bg-[rgba(var(--spark-ink-rgb),0.04)]"
          title="Open Staffing Board filtered to unstaffed shifts"
        >
          <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
            Unstaffed · next 7 days
          </p>
          <p
            className="tab-num text-2xl sm:text-3xl font-bold"
            style={{
              color: unstaffed > 0 ? "var(--spark-orange)" : "var(--spark-text)",
            }}
          >
            {unstaffed.toLocaleString()}
          </p>
          <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            Fill on Staffing Board →
          </p>
        </Link>
      </div>

      {/* Mini 7-day day-by-day pill strip */}
      <div
        role="group"
        aria-label="7-day unstaffed breakdown"
        className="grid grid-cols-7 gap-1 pt-1"
      >
        {summary.days.map((day) => {
          const hasGap = day.unstaffed > 0;
          const empty = day.total === 0;
          return (
            <Link
              key={day.ymd}
              to={day.to}
              title={
                empty
                  ? `${day.label} (${day.ymd}): no shifts`
                  : hasGap
                    ? `${day.label} (${day.ymd}): ${day.unstaffed} unstaffed of ${day.total}`
                    : `${day.label} (${day.ymd}): all ${day.total} staffed`
              }
              className="rounded-lg px-1 py-1.5 text-center no-underline transition hover:opacity-90"
              style={{
                background: hasGap
                  ? "rgba(239, 90, 42, 0.11)"
                  : "var(--spark-surface-2)",
                border: hasGap
                  ? "1px solid rgba(239, 90, 42, 0.35)"
                  : "1px solid var(--spark-border)",
                opacity: empty ? 0.45 : 1,
              }}
            >
              <span
                className="block text-[10px] font-medium truncate"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {day.label}
              </span>
              <span
                className="block text-xs font-bold tab-num mt-0.5"
                style={{
                  color: hasGap
                    ? "var(--spark-orange)"
                    : empty
                      ? "var(--spark-text-meta)"
                      : "var(--spark-ok-ink)",
                }}
              >
                {empty ? "—" : hasGap ? `${day.unstaffed}` : "✓"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default StaffingGlanceCard;
