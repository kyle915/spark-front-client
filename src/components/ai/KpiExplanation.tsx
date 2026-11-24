import { Component, Suspense, useState, type ReactNode } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TenantKpiExplanationQuery } from "@/api/queries/TenantKpiExplanationQuery";
import type { TenantKpiExplanationQuery as ExplanationQueryType } from "@api/queries/__generated__/TenantKpiExplanationQuery.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import {
  excludedLine,
  fixTargets,
  howLabel,
  mappingHref,
  recapsText,
  type KpiMetric,
} from "@/lib/kpiExplain";

/**
 * "How is this counted?" for one Program KPI tile.
 *
 * Wraps the tile in a button; opening it asks the server for the
 * explanation (tenantKpiExplanation) — only then, never with the dashboard.
 * The server computes the total with the tile's own aggregation, so the
 * number here always equals the tile. Clients read the same explanation;
 * Ignite staff (in admin mode) also get a link to the form's mapping card.
 */

const META = { color: "var(--spark-text-meta)" } as const;

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="text-[13px]" style={META}>
          This explanation could not load. Try again in a moment.
        </p>
      );
    }
    return this.props.children;
  }
}

const Body: React.FC<{
  tenantId: string;
  metric: KpiMetric;
  year: number | null;
}> = ({ tenantId, metric, year }) => {
  const { isAdmin } = useSparkRole();
  const data = useLazyLoadQuery<ExplanationQueryType>(
    TenantKpiExplanationQuery,
    { tenantId, metric, year },
    { fetchPolicy: "store-or-network" },
  );
  const e = data.tenantKpiExplanation;
  if (!e) {
    return (
      <p className="text-[13px]" style={META}>
        There is no explanation for this number yet.
      </p>
    );
  }
  const fixes = e.canFixMapping && isAdmin ? fixTargets(e.sources, e.notTrackedTemplates) : [];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="spark-kpi-label">{e.label}</p>
        <p className="spark-kpi-value spark-kpi-value-sm">{e.total.toLocaleString()}</p>
      </div>
      <p className="text-[13px] leading-snug" style={{ color: "var(--spark-text)" }}>
        {e.summary}
      </p>

      {e.sources.length > 0 && (
        <div className="flex flex-col gap-2">
          {e.sources.map((s) => (
            <div
              key={`${s.templateId ?? "standard"}-${s.templateName}`}
              className="pt-2"
              style={{ borderTop: "1px solid var(--spark-border)" }}
            >
              <p className="text-[13px] font-semibold" style={{ color: "var(--spark-text)" }}>
                {s.templateName || "Recap form"}
              </p>
              <p className="text-xs" style={META}>
                {recapsText(s.recaps)}
                {s.value != null ? ` · ${s.value.toLocaleString()}` : ""}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {s.fields.map((f) => (
                  <li key={f.label} className="text-[13px] flex justify-between gap-3">
                    <span className="min-w-0">
                      <span style={{ color: "var(--spark-text)" }}>“{f.label}”</span>
                      <span className="block text-xs" style={META}>
                        {howLabel(f.how)}
                      </span>
                    </span>
                    {f.value != null && (
                      <span className="tabular-nums shrink-0" style={{ color: "var(--spark-text)" }}>
                        {f.value.toLocaleString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {e.recapsWithoutValue > 0 && (
        <p className="text-xs" style={META}>
          {recapsText(e.recapsWithoutValue)} in this period had no answer for this number.
        </p>
      )}

      {e.excluded.length > 0 && (
        <div className="pt-2" style={{ borderTop: "1px solid var(--spark-border)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--spark-text)" }}>
            Not counted
          </p>
          <ul className="flex flex-col gap-0.5">
            {e.excluded.map((b) => (
              <li key={b.key} className="text-xs flex justify-between gap-3" style={META}>
                <span>{b.label}</span>
                <span className="tabular-nums">{excludedLine(b)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.notTrackedTemplates.length > 0 && (
        <p className="text-xs" style={META}>
          Not tracked on {e.notTrackedTemplates.length === 1 ? "this form" : "these forms"}:{" "}
          {e.notTrackedTemplates.map((t) => t.templateName).join(", ")}.
        </p>
      )}

      {e.note && (
        <p className="text-xs" style={META}>
          {e.note}
        </p>
      )}

      {fixes.length > 0 && (
        <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid var(--spark-border)" }}>
          {fixes.map((t) => (
            <Link
              key={t.uuid}
              to={mappingHref(t.uuid)}
              className="text-[13px] font-semibold underline underline-offset-2"
              style={{ color: "var(--spark-text)" }}
            >
              Fix mapping on {t.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const KpiExplainTrigger: React.FC<{
  tenantId: string;
  metric: KpiMetric | undefined;
  year: number | null;
  label: string;
  className?: string;
  children: ReactNode;
}> = ({ tenantId, metric, year, label, className, children }) => {
  const [open, setOpen] = useState(false);
  if (!metric) return <div className={className}>{children}</div>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How ${label.toLowerCase()} is counted`}
          title="How this is counted"
          className={`spark-kpi-explain-trigger text-left w-full cursor-pointer rounded-lg ${className ?? ""}`}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[min(380px,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto"
        style={{
          background: "var(--spark-surface)",
          borderColor: "var(--spark-border)",
          color: "var(--spark-text)",
        }}
      >
        {open && (
          <Quiet>
            <Suspense
              fallback={
                <p className="text-[13px]" style={META}>
                  Checking how this is counted…
                </p>
              }
            >
              <Body tenantId={tenantId} metric={metric} year={year} />
            </Suspense>
          </Quiet>
        )}
      </PopoverContent>
    </Popover>
  );
};
