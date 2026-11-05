import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { TenantProgramHealthQuery } from "@/api/queries/TenantProgramHealthQuery";
import type { TenantProgramHealthQuery as TenantProgramHealthQueryType } from "@api/queries/__generated__/TenantProgramHealthQuery.graphql";
import { showsMissingRecaps } from "@/field/missingRecaps";
import { useAuthStore } from "@/store/authStore";

/**
 * Program-health funnel for the Insights page range: scheduled → filed
 * (content-submitted, not empty shells) → approved. Missing drills to
 * /recaps/missing.
 */

const Inner: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
}> = ({ tenantId, startDate, endDate, rangeLabel }) => {
  const navigate = useNavigate();
  const { tenantSlug, tenantMeta } = useAuthStore();
  const missingRecapsOn = showsMissingRecaps(
    tenantSlug,
    tenantMeta?.requestUrlName,
  );
  const data = useLazyLoadQuery<TenantProgramHealthQueryType>(
    TenantProgramHealthQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const health = data.tenantProgramHealth;
  if (!health) return null;

  const { scheduled, filed, approved, missing } = health;
  const filedPct = scheduled > 0 ? Math.round((filed / scheduled) * 100) : null;
  const approvedPct = filed > 0 ? Math.round((approved / filed) * 100) : null;
  const weak = missing > 0 || (filedPct != null && filedPct < 80);

  return (
    <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            PROGRAM HEALTH · {rangeLabel.toUpperCase()}
          </p>
          <h2
            className="display text-lg font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Scheduled → filed → approved
          </h2>
        </div>
        {missingRecapsOn ? (
          <button
            type="button"
            onClick={() => navigate("/recaps/missing")}
            className="mono text-[10px] px-3 py-1.5 rounded-lg"
            style={{
              letterSpacing: "0.12em",
              color: weak ? "var(--spark-orange)" : "rgba(255,255,255,0.55)",
              border: `1px solid ${
                weak ? "rgba(239,90,42,0.40)" : "var(--spark-border)"
              }`,
            }}
          >
            {missing > 0 ? `${missing} MISSING →` : "MISSING RECAPS →"}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Step
          label="Scheduled"
          value={scheduled}
          tone="neutral"
        />
        <Step
          label="Filed"
          value={filed}
          sub={filedPct != null ? `${filedPct}%` : undefined}
          tone={
            filedPct != null && filedPct < 80
              ? "orange"
              : filed > 0
                ? "lime"
                : "neutral"
          }
          hint="photos / metrics"
        />
        <Step
          label="Approved"
          value={approved}
          sub={approvedPct != null ? `${approvedPct}% of filed` : undefined}
          tone={approved > 0 ? "lime" : "neutral"}
        />
      </div>
    </div>
  );
};

const Step: React.FC<{
  label: string;
  value: number;
  sub?: string;
  hint?: string;
  tone: "lime" | "orange" | "neutral";
}> = ({ label, value, sub, hint, tone }) => {
  const color =
    tone === "lime"
      ? "var(--spark-lime)"
      : tone === "orange"
        ? "var(--spark-orange)"
        : "var(--spark-text)";
  const bg =
    tone === "lime"
      ? "rgba(242,243,238,0.08)"
      : tone === "orange"
        ? "rgba(239,90,42,0.10)"
        : "rgba(255,255,255,0.03)";
  const border =
    tone === "lime"
      ? "rgba(242,243,238,0.30)"
      : tone === "orange"
        ? "rgba(239,90,42,0.35)"
        : "var(--spark-border)";

  return (
    <div className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>
      <p
        className="mono text-[9px]"
        style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
      >
        {label.toUpperCase()}
      </p>
      <p className="tab-num font-bold mt-1 text-2xl" style={{ color }}>
        {value.toLocaleString()}
      </p>
      {(sub || hint) && (
        <p
          className="text-[10px] mt-0.5 truncate"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {[sub, hint].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
};

export default function ProgramHealthTile(props: {
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
}) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
