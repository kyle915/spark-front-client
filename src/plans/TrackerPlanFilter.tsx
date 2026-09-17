/**
 * Master Tracker plan dropdown — pick an Activation Plan without needing
 * a deep-link from /plans.
 */

import { Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { ActivationPlansQuery } from "@/api/queries/ActivationPlansQuery";
import type { ActivationPlansQuery as ActivationPlansQueryType } from "@api/queries/__generated__/ActivationPlansQuery.graphql";

function PlanFilterSelectInner({
  tenantId,
  planId,
  onChange,
}: {
  tenantId: string;
  planId: string | null;
  onChange: (planId: string | null) => void;
}) {
  const data = useLazyLoadQuery<ActivationPlansQueryType>(
    ActivationPlansQuery,
    { tenantId, first: 200 },
    { fetchPolicy: "store-or-network" },
  );
  const plans = data.activationPlans ?? [];
  if (plans.length === 0) return null;

  return (
    <label className="flex items-center gap-2">
      <span className="label-mini">PLAN</span>
      <select
        value={planId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-xl text-xs"
        style={{
          padding: "0.45rem 0.9rem",
          background: "var(--spark-bg)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
          outline: "none",
          maxWidth: 220,
        }}
      >
        <option value="">All plans</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.requestCount > 0 ? ` (${p.requestCount})` : ""}
          </option>
        ))}
      </select>
      {planId ? (
        <Link
          to={`/plans/${plans.find((p) => p.id === planId)?.uuid ?? ""}`}
          className="mono text-[9px]"
          style={{ letterSpacing: "0.1em", color: "var(--spark-lime)" }}
          title="Open plan"
        >
          VIEW
        </Link>
      ) : (
        <Link
          to="/plans"
          className="mono text-[9px]"
          style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}
        >
          ALL
        </Link>
      )}
    </label>
  );
}

export default function TrackerPlanFilter({
  tenantId,
  planId,
  onChange,
}: {
  tenantId: string | null | undefined;
  planId: string | null;
  onChange: (planId: string | null) => void;
}) {
  if (!tenantId) return null;
  return (
    <Suspense fallback={null}>
      <PlanFilterSelectInner
        tenantId={tenantId}
        planId={planId}
        onChange={onChange}
      />
    </Suspense>
  );
}
