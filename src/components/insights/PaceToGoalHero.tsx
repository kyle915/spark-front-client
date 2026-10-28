import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { TenantGoalsQuery } from "@/api/queries/TenantGoalsQuery";
import type { TenantGoalsQuery as TenantGoalsQueryType } from "@api/queries/__generated__/TenantGoalsQuery.graphql";
import { SetTenantGoalsMutation } from "@/api/mutations/SetTenantGoalsMutation";
import type { SetTenantGoalsMutation as SetTenantGoalsMutationType } from "@api/mutations/__generated__/SetTenantGoalsMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Top Insights bento: pace-to-goal (annual targets) + the same metric over
 * the last 7 days. DESIGN.md bento tiles — lime/orange on real signals only.
 */

type GoalMetric =
  | "consumers_reached"
  | "samples_distributed"
  | "products_sold"
  | "total_engagements";

const PRIMARY: GoalMetric = "consumers_reached";

const METRIC_TO_ARG: Record<GoalMetric, string> = {
  consumers_reached: "targetConsumersReached",
  samples_distributed: "targetSamplesDistributed",
  products_sold: "targetProductsSold",
  total_engagements: "targetTotalEngagements",
};

const fmt = (n: number) => n.toLocaleString();

const yearElapsedPct = (year: number): number => {
  const now = new Date();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const total = end.getTime() - start.getTime();
  const done = Math.min(
    Math.max(now.getTime() - start.getTime(), 0),
    total,
  );
  return total > 0 ? Math.round((done / total) * 100) : 0;
};

const weeksRemainingInYear = (year: number): number => {
  const now = new Date();
  const end = new Date(year + 1, 0, 1);
  const ms = Math.max(end.getTime() - now.getTime(), 0);
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
};

const Inner: React.FC<{ tenantId: string; chromeless?: boolean }> = ({
  tenantId,
  chromeless = false,
}) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [fetchKey, setFetchKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [commitSetGoals, isSaving] =
    useMutation<SetTenantGoalsMutationType>(SetTenantGoalsMutation);

  const goalsData = useLazyLoadQuery<TenantGoalsQueryType>(
    TenantGoalsQuery,
    { tenantId, year: null },
    { fetchPolicy: "store-or-network", fetchKey },
  );

  const goals = goalsData?.tenantGoals;
  const year = goals?.year ?? new Date().getFullYear();
  const elapsed = yearElapsedPct(year);
  const weeksLeft = weeksRemainingInYear(year);

  const primary = useMemo(() => {
    const items = goals?.items ?? [];
    return (
      items.find((i) => i.metric === PRIMARY) ??
      items.find((i) => i.target > 0) ??
      items[0] ??
      null
    );
  }, [goals]);

  const weeklyNeed = useMemo(() => {
    if (!primary || primary.target <= 0) return null;
    const gap = Math.max(primary.target - primary.current, 0);
    return Math.ceil(gap / weeksLeft);
  }, [primary, weeksLeft]);

  const onPace =
    primary != null && primary.target > 0 && primary.pacePct >= elapsed;
  const behind =
    primary != null && primary.target > 0 && primary.pacePct < elapsed;

  const openEdit = () => {
    setDraft(primary && primary.target > 0 ? String(primary.target) : "");
    setEditing(true);
  };

  const save = () => {
    if (!primary) return;
    const raw = draft.trim();
    const value = raw === "" ? null : Math.max(0, Math.round(Number(raw)));
    if (raw !== "" && !Number.isFinite(value as number)) {
      showAlert("Enter a whole number target.", "error");
      return;
    }
    const metric = primary.metric as GoalMetric;
    if (!(metric in METRIC_TO_ARG)) {
      showAlert("Unknown metric.", "error");
      return;
    }
    // Preserve sibling targets — setTenantGoals replaces the year row.
    const variables: SetTenantGoalsMutationType["variables"] = {
      tenantId,
      year,
    };
    for (const item of goals?.items ?? []) {
      const key = item.metric as GoalMetric;
      const arg = METRIC_TO_ARG[key] as
        | keyof SetTenantGoalsMutationType["variables"]
        | undefined;
      if (!arg) continue;
      const next =
        key === metric ? value : item.target > 0 ? item.target : null;
      (variables as Record<string, unknown>)[arg] = next;
    }
    commitSetGoals({
      variables,
      onCompleted: (res) => {
        if (res.setTenantGoals) {
          showAlert("Goals updated.", "success");
          setEditing(false);
          setFetchKey((k) => k + 1);
        } else {
          showAlert("Couldn't save goals.", "error");
        }
      },
      onError: (err) => showAlert(err.message || "Couldn't save goals.", "error"),
    });
  };

  if (!goals) return null;

  const tone = behind
    ? "var(--spark-orange)"
    : onPace
      ? "var(--spark-lime)"
      : "rgba(255,255,255,0.55)";

  return (
    <div
      className={chromeless ? undefined : "spark-card p-5 lg:p-6"}
      style={chromeless ? undefined : { borderRadius: 22 }}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            PACE TO GOAL · {year}
          </p>
          <h2
            className="display text-lg lg:text-xl font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            {primary?.label ?? "Program pace"}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!chromeless && (
            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="mono text-[10px] px-3 py-1.5 rounded-lg"
              style={{
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.55)",
                border: "1px solid var(--spark-border)",
              }}
            >
              REPORTS →
            </button>
          )}
          {primary && (
            <button
              type="button"
              onClick={openEdit}
              className="mono text-[10px] px-3 py-1.5 rounded-lg"
              style={{
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid var(--spark-border)",
                background: "transparent",
              }}
            >
              EDIT TARGET
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Current / target"
          value={
            primary && primary.target > 0
              ? `${fmt(primary.current)} / ${fmt(primary.target)}`
              : primary
                ? fmt(primary.current)
                : "—"
          }
          hint={
            primary && primary.target > 0
              ? `${Math.round(primary.pacePct)}% of target`
              : "Set a target"
          }
          accent={tone}
        />
        <Tile
          label="Year elapsed"
          value={`${elapsed}%`}
          hint={behind ? "Behind calendar pace" : onPace ? "On / ahead of pace" : "Calendar"}
          accent={behind ? "var(--spark-orange)" : onPace ? "var(--spark-lime)" : undefined}
        />
        <Tile
          label="Weekly need"
          value={weeklyNeed == null ? "—" : fmt(weeklyNeed)}
          hint={
            weeklyNeed == null
              ? "No gap / no target"
              : `${weeksLeft} weeks left · to hit target`
          }
          accent={
            weeklyNeed == null
              ? undefined
              : weeklyNeed > 0
                ? "var(--spark-orange)"
                : "var(--spark-lime)"
          }
        />
        <Tile
          label="Last 7 days"
          value={primary ? fmt(primary.last7) : "—"}
          hint={primary ? `${primary.label} · incl. today` : "No pace window"}
          accent={primary && primary.last7 > 0 ? "var(--spark-lime)" : undefined}
        />
      </div>

      {primary && primary.target > 0 && (
        <div className="mt-4">
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, Math.round(primary.pacePct)))}%`,
                background: tone,
                transition: "width 240ms ease",
              }}
            />
          </div>
        </div>
      )}

      {editing && primary && (
        <div
          className="mt-4 p-4 rounded-xl flex flex-wrap items-end gap-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <label className="flex-1 min-w-[160px]">
            <span
              className="mono text-[10px] block mb-1"
              style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
            >
              {primary.label.toUpperCase()} TARGET
            </span>
            <input
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
          </label>
          <button
            type="button"
            disabled={isSaving}
            onClick={save}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-xl text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

const Tile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}> = ({ label, value, hint, accent }) => (
  <div
    className="rounded-xl p-3"
    style={{
      background: accent
        ? accent.includes("lime")
          ? "rgba(242,243,238,0.08)"
          : accent.includes("orange")
            ? "rgba(239,90,42,0.10)"
            : "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.03)",
      border: `1px solid ${
        accent?.includes("lime")
          ? "rgba(242,243,238,0.30)"
          : accent?.includes("orange")
            ? "rgba(239,90,42,0.35)"
            : "var(--spark-border)"
      }`,
    }}
  >
    <p
      className="mono text-[9px]"
      style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
    >
      {label.toUpperCase()}
    </p>
    <p
      className="tab-num font-bold mt-1 text-lg truncate"
      style={{ color: accent ?? "var(--spark-text)" }}
      title={value}
    >
      {value}
    </p>
    {hint && (
      <p
        className="text-[10px] mt-0.5 truncate"
        style={{ color: "rgba(255,255,255,0.55)" }}
        title={hint}
      >
        {hint}
      </p>
    )}
  </div>
);

export default function PaceToGoalHero({
  tenantId,
  chromeless = false,
}: {
  tenantId: string;
  /** Skip outer spark-card when nested in a connected bento. */
  chromeless?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <Inner tenantId={tenantId} chromeless={chromeless} />
    </Suspense>
  );
}
