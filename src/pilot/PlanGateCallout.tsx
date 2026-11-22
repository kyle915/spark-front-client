import React from "react";
import { Link } from "react-router";
import useSparkRole from "@/hooks/useSparkRole";
import { planBadgeMeta } from "./pilotHelpers";

interface PlanGateCalloutProps {
  title: string;
  message: string | null | undefined;
  requiredPlan?: string | null;
}

export const PlanGateCallout: React.FC<PlanGateCalloutProps> = ({
  title,
  message,
  requiredPlan,
}) => {
  const { isAdmin, canToggleRole } = useSparkRole();
  // Client-facing plan upsells stay hidden until CLIENT_BILLING_LAUNCHED.
  if (!canToggleRole || !isAdmin) return null;

  const badge = planBadgeMeta(requiredPlan || "pro");

  return (
    <section
      className="rounded-xl p-6 space-y-4"
      style={{
        background: "var(--pilot-ok-subtle)",
        border: "1px solid var(--pilot-ok-border)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold mono"
              style={{ background: badge.bg, color: badge.fg }}
            >
              Requires {badge.label} ({badge.priceSummary})
            </span>
          </div>
          <h2 className="display text-lg font-bold mt-2">{title}</h2>
          <p
            className="text-sm mt-1 max-w-2xl"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {message ||
              `Upgrade your standalone Spark workspace to ${badge.label} to unlock this workflow while preserving all historical visits and recaps.`}
          </p>
        </div>

        <Link
          to="/plans-billing"
          className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
          style={{
            background: "var(--pilot-cta-bg)",
            color: "var(--pilot-cta-fg)",
          }}
        >
          View Plans & Upgrade →
        </Link>
      </div>
    </section>
  );
};

export default PlanGateCallout;
