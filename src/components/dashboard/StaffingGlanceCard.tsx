import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { StaffingBoardQuery } from "@/api/queries/StaffingBoardQuery";
import type { StaffingBoardQuery as StaffingBoardQueryType } from "@api/queries/__generated__/StaffingBoardQuery.graphql";
import { useAuthStore } from "@/store/authStore";

const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Staffing at a glance for the selected client: shifts today and shifts
 * still unstaffed over the next 7 days. Sits right under "Needs you" so
 * the work comes before the analytics. Opens the Staffing Board.
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
  const shifts = (data?.staffingBoard ?? []).filter(Boolean);
  if (shifts.length === 0) return null;
  const today = shifts.filter((s) => String(s.date ?? "").slice(0, 10) === startDate);
  const unstaffed = shifts.filter((s) => !s.isStaffed).length;
  const unstaffedToday = today.filter((s) => !s.isStaffed).length;

  const tiles: { label: string; value: number; hint: string; warn: boolean }[] = [
    {
      label: "Shifts today",
      value: today.length,
      hint: unstaffedToday > 0 ? `${unstaffedToday} unstaffed` : "All staffed",
      warn: unstaffedToday > 0,
    },
    {
      label: "Unstaffed · next 7 days",
      value: unstaffed,
      hint: `of ${shifts.length} shifts`,
      warn: unstaffed > 0,
    },
  ];

  return (
    <button
      type="button"
      onClick={() => navigate("/schedule")}
      className="spark-card spark-stat-band text-left w-full"
      title="Open the Staffing Board"
    >
      <p className="spark-kpi-label mb-3">Staffing</p>
      <div className="grid grid-cols-2 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0">
            <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
              {t.label}
            </p>
            <p
              className="tab-num text-2xl sm:text-3xl font-bold"
              style={{ color: t.warn ? "var(--spark-orange)" : "var(--spark-text)" }}
            >
              {t.value.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
              {t.hint}
            </p>
          </div>
        ))}
      </div>
    </button>
  );
};

export default StaffingGlanceCard;
