import { useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { TenantGoalsQuery } from "@/api/queries/TenantGoalsQuery";
import type { TenantGoalsQuery as TenantGoalsQueryType } from "@api/queries/__generated__/TenantGoalsQuery.graphql";
import { SetTenantGoalsMutation } from "@/api/mutations/SetTenantGoalsMutation";
import type { SetTenantGoalsMutation as SetTenantGoalsMutationType } from "@api/mutations/__generated__/SetTenantGoalsMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Goals & pace-to-target panel for the dashboards.
 *
 * Loads `tenantGoals` (current year) for ONE client (tenant) and renders a
 * pace-to-target row per goal-tracked metric — the `label`, a "current /
 * target" readout (formatted with thousands separators), and a progress bar
 * filled to min(pacePct, 100)% with the % shown:
 *   - on / ahead of pace (pacePct ≥ 100) → lime
 *   - behind (0 < pacePct < 100)         → amber / muted
 *   - no target set (target ≤ 0)         → muted "Set a target"
 *
 * An "Edit goals" button opens a Spark-chrome modal with four number inputs
 * (pre-filled from the current targets). Saving calls `setTenantGoals` (current
 * year + the four targets) via useMutation, surfaces loading + success/error
 * states through useAlertStore, then bumps a fetchKey so the read query
 * refetches and the bars repaint.
 *
 * Mounted on both dashboards (admin DashboardEvent and the client
 * SparkClientDashboard) near the KPI charts / Insights panel, scoped to the
 * active tenant via `useAuthStore().tenantId`, the same id every per-tenant
 * surface uses. The caller renders nothing when no tenant is in scope; this
 * component is wrapped in a <Suspense> by the dashboard (same as the other
 * lazy-loaded dashboard cards) so it loads the data the app's usual way and
 * doesn't block first paint.
 *
 * Dark-theme styled to match <TenantKpiCharts> and <TenantInsightsPanel>.
 * When no targets are set, the four empty "Set a target" rows stay hidden
 * and we show one next-action instead of a hollow card.
 */

// The four goal-tracked metric slugs, in the order we render them, each mapped
// to its `setTenantGoals` argument. Keying off the stable `metric` slug (rather
// than item order) keeps the modal inputs aligned with the right target even if
// the backend reorders `items`.
type GoalMetric =
  | "consumers_reached"
  | "samples_distributed"
  | "products_sold"
  | "total_engagements";

const METRIC_ORDER: GoalMetric[] = [
  "consumers_reached",
  "samples_distributed",
  "products_sold",
  "total_engagements",
];

const METRIC_TO_ARG: Record<GoalMetric, string> = {
  consumers_reached: "targetConsumersReached",
  samples_distributed: "targetSamplesDistributed",
  products_sold: "targetProductsSold",
  total_engagements: "targetTotalEngagements",
};

// Fallback labels for the modal inputs when a metric has no row yet (e.g. the
// backend hasn't returned that item). The panel prefers the server `label`.
const METRIC_FALLBACK_LABEL: Record<GoalMetric, string> = {
  consumers_reached: "Consumers reached",
  samples_distributed: "Samples distributed",
  products_sold: "Products sold",
  total_engagements: "Total engagements",
};

type GoalItem = {
  metric: string;
  label: string;
  target: number;
  current: number;
  pacePct: number;
};

const fmt = (n: number) => n.toLocaleString();

// Round + clamp pace for the bar fill (a metric ahead of plan reports >100 but
// the bar caps at 100%). The numeric % we show is the un-clamped rounded value.
const clampPct = (pct: number) => Math.max(0, Math.min(100, Math.round(pct)));

type Tone = {
  color: string;
  track: string;
};

// Pace → bar treatment. On / ahead of pace is lime; behind is amber; no target
// is a muted track with no fill (the row shows "Set a target" instead of a %).
const toneFor = (target: number, pacePct: number): Tone => {
  if (target <= 0) {
    return { color: "var(--spark-text-meta)", track: "rgba(var(--spark-ink-rgb),0.06)" };
  }
  if (pacePct >= 100) {
    return { color: "var(--spark-lime)", track: "rgba(var(--spark-accent-rgb),0.10)" };
  }
  return { color: "var(--spark-gold, #f0b429)", track: "rgba(240,180,41,0.10)" };
};

/* ───────────────────────── pace-to-target row ───────────────────────── */

const PaceRow: React.FC<{ item: GoalItem }> = ({ item }) => {
  const hasTarget = item.target > 0;
  const tone = toneFor(item.target, item.pacePct);
  const fillPct = clampPct(item.pacePct);
  const shownPct = Math.max(0, Math.round(item.pacePct));

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: "rgba(var(--spark-ink-rgb),0.02)",
        border: "1px solid var(--spark-border)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <p
          className="font-bold text-sm"
          style={{ color: "var(--spark-text)", letterSpacing: "-0.01em" }}
        >
          {item.label}
        </p>
        {hasTarget ? (
          <p
            className="mono tab-num text-[12px] shrink-0"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            <span style={{ color: "var(--spark-text)", fontWeight: 700 }}>
              {fmt(item.current)}
            </span>{" "}
            / {fmt(item.target)}
          </p>
        ) : (
          <p
            className="mono text-[11px] shrink-0"
            style={{ letterSpacing: "0.06em", color: "var(--spark-text-meta)" }}
          >
            Set a target
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ background: tone.track }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${fillPct}%`,
              background: tone.color,
              boxShadow:
                hasTarget && item.pacePct >= 100
                  ? "0 0 10px rgba(var(--spark-accent-rgb),0.45)"
                  : "none",
              transition: "width 240ms ease",
            }}
          />
        </div>
        {hasTarget && (
          <span
            className="mono tab-num text-[11px] shrink-0"
            style={{ letterSpacing: "0.04em", color: tone.color, minWidth: 38, textAlign: "right" }}
          >
            {shownPct}%
          </span>
        )}
      </div>
    </div>
  );
};

/* ───────────────────────── edit-goals modal ───────────────────────── */

// Inputs are keyed by metric slug. Empty string = no target (sends null), so
// the user can clear a target by blanking the field.
type TargetDraft = Record<GoalMetric, string>;

const EditGoalsModal: React.FC<{
  tenantId: string;
  year: number;
  items: readonly GoalItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ tenantId, year, items, onClose, onSaved }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitSetGoals, isSaving] =
    useMutation<SetTenantGoalsMutationType>(SetTenantGoalsMutation);

  // Pre-fill each input from the current target (blank when the target is 0 /
  // unset, so the placeholder shows instead of a literal "0").
  const byMetric = useMemo(() => {
    const m = new Map<string, GoalItem>();
    for (const it of items) m.set(it.metric, it);
    return m;
  }, [items]);

  const [draft, setDraft] = useState<TargetDraft>(() => {
    const d = {} as TargetDraft;
    for (const metric of METRIC_ORDER) {
      const target = byMetric.get(metric)?.target ?? 0;
      d[metric] = target > 0 ? String(target) : "";
    }
    return d;
  });

  const labelFor = (metric: GoalMetric) =>
    byMetric.get(metric)?.label ?? METRIC_FALLBACK_LABEL[metric];

  // "" → null (clear the target); otherwise a non-negative integer. Anything
  // unparseable also clears it rather than sending NaN.
  const toTarget = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const handleSave = () => {
    if (isSaving) return;
    const variables: SetTenantGoalsMutationType["variables"] = {
      tenantId,
      year,
    };
    for (const metric of METRIC_ORDER) {
      const arg = METRIC_TO_ARG[metric] as keyof SetTenantGoalsMutationType["variables"];
      // Index assignment onto the typed variables object; every arg is an
      // optional Int? so a number | null is always valid here.
      (variables as Record<string, unknown>)[arg] = toTarget(draft[metric]);
    }

    commitSetGoals({
      variables,
      onCompleted: (res, errors) => {
        if (errors && errors.length > 0) {
          showAlert(errors[0].message || "Could not save goals.", "error");
          return;
        }
        if (res.setTenantGoals) {
          showAlert("Goals saved.", "success");
          onSaved();
          onClose();
        } else {
          showAlert("Could not save goals.", "error");
        }
      },
      onError: (err) => {
        showAlert(`Save failed: ${err.message}`, "error");
      },
    });
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--spark-bg)",
    border: "1px solid var(--spark-border)",
    borderRadius: 12,
    padding: "0.6rem 0.9rem",
    color: "var(--spark-text)",
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
    opacity: isSaving ? 0.6 : 1,
  };

  return (
    <div
      onClick={() => !isSaving && onClose()}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
      style={{ background: "rgba(var(--spark-bg-rgb),0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md spark-card p-6"
        style={{ borderRadius: 20 }}
      >
        <p
          className="mono text-[10px] mb-1"
          style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
        >
          GOALS · {year}
        </p>
        <h2
          className="display text-2xl font-bold"
          style={{ letterSpacing: "-0.03em" }}
        >
          Edit goals.
        </h2>
        <p
          className="text-sm mt-2 mb-4"
          style={{ color: "var(--spark-text-meta)", lineHeight: 1.5 }}
        >
          Set this year's targets for the program. Leave a field blank to clear
          its target.
        </p>

        <div className="space-y-3">
          {METRIC_ORDER.map((metric) => (
            <div key={metric}>
              <label className="label-mini block mb-1.5">
                {labelFor(metric)}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                disabled={isSaving}
                value={draft[metric]}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [metric]: e.target.value }))
                }
                placeholder="No target"
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          <button
            onClick={() => {
              if (!isSaving) onClose();
            }}
            className="mono text-[11px]"
            style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
          >
            CANCEL
          </button>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span
                className="mono text-[10px]"
                style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
              >
                SAVING…
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                opacity: isSaving ? 0.5 : 1,
              }}
            >
              Save goals
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────── panel ───────────────────────── */

const TenantGoalsPanel: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  // Bumped after a successful save to force useLazyLoadQuery to refetch the
  // goals (same fetchKey refresh pattern the rest of the app uses).
  const [fetchKey, setFetchKey] = useState(0);
  const [editing, setEditing] = useState(false);

  const data = useLazyLoadQuery<TenantGoalsQueryType>(
    TenantGoalsQuery,
    // year: null → current year (backend default).
    { tenantId, year: null },
    { fetchPolicy: "store-or-network", fetchKey },
  );

  const goals = data?.tenantGoals;
  const items = useMemo(() => goals?.items ?? [], [goals]);

  // Order the rows by the canonical metric order, falling back to the raw
  // server order for any unexpected extra metrics so nothing is dropped.
  const rows = useMemo<GoalItem[]>(() => {
    if (items.length === 0) return [];
    const byMetric = new Map<string, GoalItem>();
    for (const it of items) byMetric.set(it.metric, it);
    const ordered: GoalItem[] = [];
    for (const metric of METRIC_ORDER) {
      const it = byMetric.get(metric);
      if (it) {
        ordered.push(it);
        byMetric.delete(metric);
      }
    }
    // Any leftover (unknown) metrics keep their original relative order.
    for (const it of items) {
      if (byMetric.has(it.metric)) {
        ordered.push(it);
        byMetric.delete(it.metric);
      }
    }
    return ordered;
  }, [items]);

  // Reset the modal if the tenant changes out from under us mid-edit.
  useEffect(() => {
    setEditing(false);
  }, [tenantId]);

  if (!goals) return null;

  const year = goals.year;
  const hasAnyTarget = rows.some((item) => item.target > 0);

  // No targets → one next action, not four empty "Set a target" rows.
  if (!hasAnyTarget) {
    return (
      <>
        <div
          className="spark-card p-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderRadius: 18 }}
        >
          <div>
            <h2
              className="display text-lg font-bold"
              style={{ letterSpacing: "-0.02em" }}
            >
              Goals
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--spark-text-meta)" }}
            >
              No targets set for {year}.
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
            }}
          >
            Set this year's targets
          </button>
        </div>
        {editing && (
          <EditGoalsModal
            tenantId={tenantId}
            year={year}
            items={rows}
            onClose={() => setEditing(false)}
            onSaved={() => setFetchKey((k) => k + 1)}
          />
        )}
      </>
    );
  }

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Goals
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            PACE TO TARGET · {year}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="mono text-[11px] rounded-lg px-3 py-1.5 cursor-pointer"
            style={{
              background: "rgba(var(--spark-accent-rgb),0.08)",
              border: "1px solid rgba(var(--spark-accent-rgb),0.30)",
              color: "var(--spark-lime)",
              letterSpacing: "0.10em",
            }}
          >
            EDIT GOALS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((item) => (
          <PaceRow key={item.metric} item={item} />
        ))}
      </div>

      {editing && (
        <EditGoalsModal
          tenantId={tenantId}
          year={year}
          items={rows}
          onClose={() => setEditing(false)}
          onSaved={() => setFetchKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default TenantGoalsPanel;
