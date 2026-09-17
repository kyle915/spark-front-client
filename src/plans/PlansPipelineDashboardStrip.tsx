/**
 * Compact plans pipeline strip for Insights / Dashboard — shows open plans
 * with Planned→Verified counts. No orphaned KPIs; only ActivationPlan.pipeline.
 */

import { Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ActivationPlansQuery } from "@/api/queries/ActivationPlansQuery";
import type { ActivationPlansQuery as ActivationPlansQueryType } from "@api/queries/__generated__/ActivationPlansQuery.graphql";
import ActivationPlanPipelineStrip from "@/plans/ActivationPlanPipelineStrip";

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<ActivationPlansQueryType>(
    ActivationPlansQuery,
    { tenantId, first: 12 },
    { fetchPolicy: "store-or-network" },
  );
  const plans = data.activationPlans ?? [];
  if (plans.length === 0) return null;

  return (
    <div className="spark-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          ACTIVATION PLANS · PIPELINE
        </p>
        <Link
          to="/plans"
          className="mono text-[10px]"
          style={{ letterSpacing: "0.14em", color: "var(--spark-lime)" }}
        >
          ALL PLANS →
        </Link>
      </div>
      <div className="space-y-4">
        {plans.slice(0, 5).map((plan) => (
          <div key={plan.id}>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <Link
                to={`/plans/${plan.uuid}`}
                className="font-semibold text-sm truncate"
              >
                {plan.name}
              </Link>
              <Link
                to={`/requests/list?plan=${encodeURIComponent(plan.id)}`}
                className="mono text-[9px] shrink-0"
                style={{
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                TRACKER
              </Link>
            </div>
            <ActivationPlanPipelineStrip pipeline={plan.pipeline} compact />
          </div>
        ))}
      </div>
    </div>
  );
};

export default function PlansPipelineDashboardStrip({
  tenantId,
}: {
  tenantId: string | null | undefined;
}) {
  if (!tenantId) return null;
  // Soft-fail: if API hasn't rolled ActivationPlan yet (or field is
  // missing), hide the strip instead of blanking Insights / Dashboard.
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <Inner tenantId={tenantId} />
      </Suspense>
    </ErrorBoundary>
  );
}
