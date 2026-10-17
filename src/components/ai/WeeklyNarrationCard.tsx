import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantWeeklyNarrationQuery } from "@/api/queries/TenantWeeklyNarrationQuery";
import type { TenantWeeklyNarrationQuery as TenantWeeklyNarrationQueryType } from "@api/queries/__generated__/TenantWeeklyNarrationQuery.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import AiMarkdown from "./AiMarkdown";

/**
 * Admin-only weekly paragraph stored by the narration job. Mounted beside
 * Insights. The read does not call the model.
 */
function formatWeek(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return `${start} – ${end}`;
  }
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

const WeeklyNarrationBody: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<TenantWeeklyNarrationQueryType>(
    TenantWeeklyNarrationQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const narration = data.tenantWeeklyNarration;

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Weekly narration
        </h2>
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
        >
          {narration
            ? `WEEK OF ${formatWeek(narration.weekStart, narration.weekEnd).toUpperCase()}`
            : "WAITING ON THE WEEKLY JOB"}
        </p>
      </div>
      {narration ? (
        <>
          <AiMarkdown>{narration.body}</AiMarkdown>
          <p
            className="mono text-[10px] mt-4"
            style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)" }}
          >
            {narration.filedRecaps} FILED RECAPS · NUMBERS FROM INSIGHT BUCKETS
          </p>
        </>
      ) : (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          No weekly narration stored yet. It appears after the weekly job runs.
        </p>
      )}
    </div>
  );
};

const WeeklyNarrationCard: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const { isClient } = useSparkRole();
  if (isClient || !tenantId) return null;
  return (
    <Suspense fallback={null}>
      <WeeklyNarrationBody tenantId={tenantId} />
    </Suspense>
  );
};

export default WeeklyNarrationCard;
