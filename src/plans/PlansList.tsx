/**
 * Leadership Activation Plans portfolio — card-first, calm hierarchy.
 */

import { Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/layout/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ActivationPlansQuery } from "@/api/queries/ActivationPlansQuery";
import type { ActivationPlansQuery as ActivationPlansQueryType } from "@api/queries/__generated__/ActivationPlansQuery.graphql";
import { CreateActivationPlanMutation } from "@/api/mutations/CreateActivationPlanMutation";
import type { CreateActivationPlanMutation as CreateActivationPlanMutationType } from "@api/mutations/__generated__/CreateActivationPlanMutation.graphql";
import ActivationPlanPipelineStrip from "@/plans/ActivationPlanPipelineStrip";
import {
  formatPlanWindow,
  planHealth,
  planStaffedRate,
  planVerifiedRate,
  planWindowKind,
  type PlanWindowKind,
} from "@/plans/planHealth";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkPrimaryButton from "@/shared/SparkPrimaryButton";
import SparkEmptyState from "@/shared/SparkEmptyState";
import SparkFilterBar from "@/shared/SparkFilterBar";
import "@/plans/plans.css";

type PlanRow = NonNullable<
  ActivationPlansQueryType["response"]["activationPlans"]
>[number];

type WindowFilter = "all" | PlanWindowKind;
type SortKey = "start" | "name" | "health" | "planned";
type ViewMode = "cards" | "list";

const WINDOW_LABEL: Record<PlanWindowKind, string> = {
  upcoming: "Upcoming",
  active: "Active",
  past: "Past",
  undated: "No dates",
};

const healthRank: Record<string, number> = {
  needs_staffing: 0,
  needs_recaps: 1,
  empty: 2,
  on_track: 3,
  done: 4,
};

const CreatePlanSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: (uuid?: string | null) => void;
}> = ({ open, onClose, onCreated }) => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const [commit, inFlight] =
    useMutation<CreateActivationPlanMutationType>(CreateActivationPlanMutation);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [markets, setMarkets] = useState("");

  const reset = () => {
    setStep(1);
    setName("");
    setBrief("");
    setStartDate("");
    setEndDate("");
    setMarkets("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !name.trim()) return;
    commit({
      variables: {
        input: {
          tenantId,
          name: name.trim(),
          conceptBrief: brief.trim() || null,
          startDate: startDate || null,
          endDate: endDate || null,
          markets: markets
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
        },
      },
      onCompleted: (resp) => {
        const r = resp.createActivationPlan;
        if (!r?.success) {
          showAlert(r?.message || "Could not create plan", "error");
          return;
        }
        showAlert("Plan created", "success");
        const uuid = r.activationPlan?.uuid;
        reset();
        onClose();
        onCreated(uuid);
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  if (!open) return null;

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={submit}
      className="plans-card space-y-4 max-w-lg w-full"
    >
      <div>
        <h2 className="plans-title text-xl font-semibold">New plan</h2>
        <p className="plans-support mt-1 text-sm">
          {step === 1
            ? "Name the slate leadership will review."
            : "Optional window, markets, and brief."}
        </p>
      </div>

      {step === 1 ? (
        <input
          className="plans-input"
          placeholder="e.g. Q4 West Coast Retail"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm space-y-1.5 block">
              <span style={{ color: "var(--plan-muted)" }}>Start</span>
              <input
                type="date"
                className="plans-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1.5 block">
              <span style={{ color: "var(--plan-muted)" }}>End</span>
              <input
                type="date"
                className="plans-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
          <input
            className="plans-input"
            placeholder="Markets (CA, TX, NY)"
            value={markets}
            onChange={(e) => setMarkets(e.target.value)}
          />
          <textarea
            className="plans-input min-h-[72px]"
            placeholder="Concept brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {step === 1 ? (
          <>
            <button
              type="button"
              className="plans-btn-primary"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
            <button
              type="button"
              className="plans-btn-ghost"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              className="plans-btn-primary"
              disabled={inFlight || !name.trim()}
            >
              {inFlight ? "Creating…" : "Create plan"}
            </button>
            <button
              type="button"
              className="plans-btn-ghost"
              onClick={() => setStep(1)}
            >
              Back
            </button>
          </>
        )}
      </div>
    </motion.form>
  );
};

const PlanCard: React.FC<{ plan: PlanRow }> = ({ plan }) => {
  const health = planHealth(plan.pipeline);
  const windowKind = planWindowKind(plan.startDate, plan.endDate);
  const owner = plan.ownerName || plan.ownerEmail;

  return (
    <Link
      to={`/plans/${plan.uuid}`}
      className="plans-card plans-card-interactive block no-underline"
      style={{ color: "inherit" }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="plans-title text-xl font-semibold truncate">
            {plan.name}
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "var(--plan-faint)" }}>
            {WINDOW_LABEL[windowKind]} ·{" "}
            {formatPlanWindow(plan.startDate, plan.endDate)}
            {plan.markets.length > 0
              ? ` · ${plan.markets.slice(0, 3).join(", ")}${
                  plan.markets.length > 3 ? "…" : ""
                }`
              : ""}
            {owner ? ` · ${owner}` : ""}
          </p>
        </div>
        <span className="plans-health shrink-0" style={{ color: health.color }}>
          {health.label}
        </span>
      </div>
      {plan.conceptBrief ? (
        <p
          className="text-sm mb-4 line-clamp-2"
          style={{ color: "var(--plan-muted)" }}
        >
          {plan.conceptBrief}
        </p>
      ) : null}
      <ActivationPlanPipelineStrip pipeline={plan.pipeline} compact />
      <p
        className="mt-4 text-sm font-medium"
        style={{ color: "var(--spark-lime)" }}
      >
        Open plan
      </p>
    </Link>
  );
};

const PortfolioInner: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<ActivationPlansQueryType>(
    ActivationPlansQuery,
    { tenantId: tenantId ?? null, first: 200 },
    {
      fetchPolicy: refreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: `${tenantId ?? ""}|${refreshKey}`,
    },
  );
  const plans = data.activationPlans ?? [];

  const [search, setSearch] = useState("");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("start");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const rollup = useMemo(() => {
    return plans.reduce(
      (acc, p) => {
        acc.planned += p.pipeline.planned;
        acc.approved += p.pipeline.approved;
        acc.staffed += p.pipeline.staffed;
        acc.executed += p.pipeline.executed;
        acc.verified += p.pipeline.verified;
        return acc;
      },
      { planned: 0, approved: 0, staffed: 0, executed: 0, verified: 0 },
    );
  }, [plans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows: PlanRow[] = [...plans];
    if (windowFilter !== "all") {
      rows = rows.filter(
        (p) => planWindowKind(p.startDate, p.endDate) === windowFilter,
      );
    }
    if (q) {
      rows = rows.filter((p) => {
        const hay = [
          p.name,
          p.conceptBrief,
          p.ownerName ?? "",
          p.ownerEmail ?? "",
          ...(p.markets ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    rows.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "planned":
          return b.pipeline.planned - a.pipeline.planned;
        case "health": {
          const ha = healthRank[planHealth(a.pipeline).kind] ?? 99;
          const hb = healthRank[planHealth(b.pipeline).kind] ?? 99;
          return ha - hb;
        }
        case "start": {
          const as = a.startDate ?? "";
          const bs = b.startDate ?? "";
          if (as === bs) return a.name.localeCompare(b.name);
          if (!as) return 1;
          if (!bs) return -1;
          return bs.localeCompare(as);
        }
        default: {
          const _exhaustive: never = sortKey;
          void _exhaustive;
          return 0;
        }
      }
    });
    return rows;
  }, [plans, search, windowFilter, sortKey]);

  if (plans.length === 0) {
    return (
      <SparkEmptyState
        title="No plans yet"
        body="Create a named slate for a quarter or market, then add requests from the plan or Master Tracker."
      />
    );
  }

  return (
    <div className="space-y-6 spark-fade-in">
      <div className="plans-card">
        <p className="text-sm mb-4" style={{ color: "var(--plan-muted)" }}>
          {plans.length} plan{plans.length === 1 ? "" : "s"} · {rollup.planned}{" "}
          request{rollup.planned === 1 ? "" : "s"} across the portfolio
        </p>
        <ActivationPlanPipelineStrip pipeline={rollup} />
      </div>

      <SparkFilterBar
        search={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans…"
            className="spark-filter-search"
            style={{ maxWidth: 260, minWidth: 180 }}
          />
        }
        trailing={
          <div className="flex gap-1">
            <button
              type="button"
              className={`plans-chip ${viewMode === "cards" ? "plans-chip-on" : ""}`}
              onClick={() => setViewMode("cards")}
            >
              Cards
            </button>
            <button
              type="button"
              className={`plans-chip ${viewMode === "list" ? "plans-chip-on" : ""}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
        }
      >
        {(
          [
            ["all", "All"],
            ["active", "Active"],
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["undated", "No dates"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setWindowFilter(value)}
            className={`plans-chip ${windowFilter === value ? "plans-chip-on" : ""}`}
          >
            {label}
          </button>
        ))}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="plans-chip bg-transparent"
        >
          <option value="start">Sort by window</option>
          <option value="health">Sort by health</option>
          <option value="planned">Sort by size</option>
          <option value="name">Sort by name</option>
        </select>
      </SparkFilterBar>

      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--plan-faint)" }}>
          No plans match these filters.
        </p>
      ) : viewMode === "cards" ? (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <div className="plans-card overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr
                  className="text-xs"
                  style={{
                    color: "var(--plan-faint)",
                    borderBottom: "1px solid var(--spark-border)",
                  }}
                >
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-3 py-3 font-medium">Window</th>
                  <th className="px-3 py-3 font-medium">Health</th>
                  <th className="px-3 py-3 font-medium text-right">Planned</th>
                  <th className="px-3 py-3 font-medium text-right">Staffed</th>
                  <th className="px-3 py-3 font-medium text-right">Verified</th>
                  <th className="px-5 py-3 font-medium text-right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((plan) => {
                  const health = planHealth(plan.pipeline);
                  return (
                    <tr
                      key={plan.id}
                      style={{ borderBottom: "1px solid var(--spark-border)" }}
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/plans/${plan.uuid}`}
                          className="font-semibold text-sm hover:underline"
                        >
                          {plan.name}
                        </Link>
                      </td>
                      <td
                        className="px-3 py-3.5 text-sm whitespace-nowrap"
                        style={{ color: "var(--plan-muted)" }}
                      >
                        {formatPlanWindow(plan.startDate, plan.endDate)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className="plans-health text-xs"
                          style={{ color: health.color }}
                        >
                          {health.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right tab-num font-semibold">
                        {plan.pipeline.planned}
                      </td>
                      <td className="px-3 py-3.5 text-right tab-num font-semibold">
                        {plan.pipeline.staffed}
                        <span
                          className="block text-xs font-normal"
                          style={{ color: "var(--plan-faint)" }}
                        >
                          {Math.round(planStaffedRate(plan.pipeline) * 100)}%
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right tab-num font-semibold">
                        {plan.pipeline.verified}
                        <span
                          className="block text-xs font-normal"
                          style={{ color: "var(--plan-faint)" }}
                        >
                          {Math.round(planVerifiedRate(plan.pipeline) * 100)}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/requests/list?plan=${encodeURIComponent(plan.id)}`}
                          className="text-sm"
                          style={{ color: "var(--spark-lime)" }}
                        >
                          Tracker
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default function PlansList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const environment = useRelayEnvironment();
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  const navigate = useNavigate();

  const bump = () => {
    if (tenantId) {
      fetchQuery(environment, ActivationPlansQuery, {
        tenantId,
        first: 200,
      }).subscribe({
        complete: () => setRefreshKey((k) => k + 1),
        error: () => setRefreshKey((k) => k + 1),
      });
    } else {
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <Layout>
      <div className="plans-shell spark-fade-in">
        <SparkPageHeader
          title="Plans"
          support="Proposed vs staffed vs done across every activation slate."
          action={
            isAdmin && !createOpen ? (
              <SparkPrimaryButton onClick={() => setCreateOpen(true)}>
                New plan
              </SparkPrimaryButton>
            ) : null
          }
        />

        <AnimatePresence>
          {createOpen ? (
            <CreatePlanSheet
              open={createOpen}
              onClose={() => setCreateOpen(false)}
              onCreated={(uuid) => {
                bump();
                if (uuid) navigate(`/plans/${uuid}`);
              }}
            />
          ) : null}
        </AnimatePresence>

        <ErrorBoundary>
          <Suspense
            fallback={
              <div
                className="plans-card text-center text-sm py-10"
                style={{ color: "var(--plan-muted)" }}
              >
                Loading plans…
              </div>
            }
          >
            <PortfolioInner refreshKey={refreshKey} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </Layout>
  );
}
