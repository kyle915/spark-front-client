/**
 * Leadership Activation Plans portfolio — scan every plan for the tenant:
 * rollup pipeline, health, filters, then drill into a plan or Tracker.
 */

import { Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import Layout from "@/layout/Layout";
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

type PlanRow = NonNullable<
  ActivationPlansQueryType["response"]["activationPlans"]
>[number];

type WindowFilter = "all" | PlanWindowKind;
type SortKey = "start" | "name" | "health" | "planned";

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

const CreatePlanForm: React.FC<{ onCreated: (uuid?: string | null) => void }> = ({
  onCreated,
}) => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const [commit, inFlight] =
    useMutation<CreateActivationPlanMutationType>(CreateActivationPlanMutation);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [markets, setMarkets] = useState("");
  const [open, setOpen] = useState(false);

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
        setName("");
        setBrief("");
        setStartDate("");
        setEndDate("");
        setMarkets("");
        setOpen(false);
        onCreated(uuid);
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-sm"
        style={{
          background: "var(--spark-lime)",
          color: "#0a0a0a",
          border: "none",
        }}
        onClick={() => setOpen(true)}
      >
        + New plan
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="spark-card p-5 space-y-3 w-full max-w-xl">
      <p
        className="mono text-[10px]"
        style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
      >
        NEW ACTIVATION PLAN
      </p>
      <input
        className="input input-bordered w-full bg-transparent"
        placeholder="Plan name (e.g. Q4 West Coast Retail)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />
      <textarea
        className="textarea textarea-bordered w-full bg-transparent"
        placeholder="Concept brief — what leadership should know"
        rows={2}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs space-y-1">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Start</span>
          <input
            type="date"
            className="input input-bordered w-full bg-transparent"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="text-xs space-y-1">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>End</span>
          <input
            type="date"
            className="input input-bordered w-full bg-transparent"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>
      <input
        className="input input-bordered w-full bg-transparent"
        placeholder="Markets (comma-separated, e.g. CA, TX, NY)"
        value={markets}
        onChange={(e) => setMarkets(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-sm"
          disabled={inFlight || !name.trim()}
          style={{
            background: "var(--spark-lime)",
            color: "#0a0a0a",
            border: "none",
          }}
        >
          {inFlight ? "Saving…" : "Create plan"}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
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
        case "start":
        default: {
          const as = a.startDate ?? "";
          const bs = b.startDate ?? "";
          if (as === bs) return a.name.localeCompare(b.name);
          // Undated last; newest window first
          if (!as) return 1;
          if (!bs) return -1;
          return bs.localeCompare(as);
        }
      }
    });
    return rows;
  }, [plans, search, windowFilter, sortKey]);

  if (plans.length === 0) {
    return (
      <div
        className="spark-card p-10 text-center space-y-3"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <p className="text-lg font-semibold" style={{ color: "var(--spark-text)" }}>
          No activation plans yet
        </p>
        <p className="text-sm max-w-md mx-auto">
          Create a named slate for a quarter or market, then attach requests from
          the plan or Master Tracker. Leadership uses this page to see proposed
          vs staffed vs done.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Portfolio rollup */}
      <div className="spark-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ALL PLANS · {plans.length} SLATE{plans.length === 1 ? "" : "S"} ·{" "}
            {rollup.planned} REQUEST{rollup.planned === 1 ? "" : "S"}
          </p>
        </div>
        <ActivationPlanPipelineStrip pipeline={rollup} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plans, markets, owner…"
          className="rounded-xl text-xs"
          style={{
            padding: "0.45rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            minWidth: 220,
            outline: "none",
          }}
        />
        {(
          [
            ["all", "All windows"],
            ["active", "Active"],
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["undated", "No dates"],
          ] as const
        ).map(([value, label]) => {
          const on = windowFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setWindowFilter(value)}
              className="mono text-[9px] px-2.5 py-1.5 rounded-lg"
              style={{
                letterSpacing: "0.12em",
                color: on ? "#0a0a0a" : "rgba(255,255,255,0.55)",
                background: on ? "var(--spark-lime)" : "transparent",
                border: "1px solid var(--spark-border)",
              }}
            >
              {label.toUpperCase()}
            </button>
          );
        })}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="mono text-[9px] px-2 py-1.5 rounded-lg bg-transparent"
          style={{
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <option value="start">Sort · window</option>
          <option value="health">Sort · health</option>
          <option value="planned">Sort · size</option>
          <option value="name">Sort · name</option>
        </select>
      </div>

      {/* Leadership table */}
      <div className="spark-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr
                className="mono text-[9px]"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.45)",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <th className="px-4 py-3 font-normal">PLAN</th>
                <th className="px-3 py-3 font-normal">WINDOW</th>
                <th className="px-3 py-3 font-normal">HEALTH</th>
                <th className="px-3 py-3 font-normal text-right">PLANNED</th>
                <th className="px-3 py-3 font-normal text-right">STAFFED</th>
                <th className="px-3 py-3 font-normal text-right">EXECUTED</th>
                <th className="px-3 py-3 font-normal text-right">VERIFIED</th>
                <th className="px-4 py-3 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    No plans match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((plan) => {
                  const health = planHealth(plan.pipeline);
                  const windowKind = planWindowKind(
                    plan.startDate,
                    plan.endDate,
                  );
                  const staffPct = Math.round(
                    planStaffedRate(plan.pipeline) * 100,
                  );
                  const verifiedPct = Math.round(
                    planVerifiedRate(plan.pipeline) * 100,
                  );
                  return (
                    <tr
                      key={plan.id}
                      style={{ borderBottom: "1px solid var(--spark-border)" }}
                    >
                      <td className="px-4 py-3.5 align-top min-w-[180px]">
                        <Link
                          to={`/plans/${plan.uuid}`}
                          className="font-semibold text-sm hover:underline"
                        >
                          {plan.name}
                        </Link>
                        <p
                          className="mono text-[9px] mt-1"
                          style={{
                            letterSpacing: "0.1em",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          {WINDOW_LABEL[windowKind].toUpperCase()}
                          {plan.markets.length > 0
                            ? ` · ${plan.markets.slice(0, 4).join(", ")}${
                                plan.markets.length > 4 ? "…" : ""
                              }`
                            : ""}
                          {plan.ownerName
                            ? ` · ${plan.ownerName}`
                            : plan.ownerEmail
                              ? ` · ${plan.ownerEmail}`
                              : ""}
                        </p>
                        {plan.conceptBrief ? (
                          <p
                            className="text-xs mt-1 line-clamp-1"
                            style={{ color: "rgba(255,255,255,0.5)" }}
                          >
                            {plan.conceptBrief}
                          </p>
                        ) : null}
                      </td>
                      <td
                        className="px-3 py-3.5 align-top text-xs whitespace-nowrap"
                        style={{ color: "rgba(255,255,255,0.65)" }}
                      >
                        {formatPlanWindow(plan.startDate, plan.endDate)}
                      </td>
                      <td className="px-3 py-3.5 align-top">
                        <span
                          className="mono text-[9px] px-2 py-1 rounded-full whitespace-nowrap"
                          style={{
                            letterSpacing: "0.1em",
                            color: health.color,
                            border: `1px solid ${health.color}`,
                            background: "transparent",
                          }}
                        >
                          {health.label.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 align-top text-right tab-num font-bold">
                        {plan.pipeline.planned}
                      </td>
                      <td className="px-3 py-3.5 align-top text-right">
                        <span className="tab-num font-bold">
                          {plan.pipeline.staffed}
                        </span>
                        <span
                          className="mono text-[9px] block"
                          style={{ color: "rgba(255,255,255,0.4)" }}
                        >
                          {staffPct}%
                        </span>
                      </td>
                      <td className="px-3 py-3.5 align-top text-right tab-num font-bold">
                        {plan.pipeline.executed}
                      </td>
                      <td className="px-3 py-3.5 align-top text-right">
                        <span className="tab-num font-bold">
                          {plan.pipeline.verified}
                        </span>
                        <span
                          className="mono text-[9px] block"
                          style={{ color: "rgba(255,255,255,0.4)" }}
                        >
                          {verifiedPct}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        <Link
                          to={`/plans/${plan.uuid}`}
                          className="mono text-[9px] mr-3"
                          style={{
                            letterSpacing: "0.12em",
                            color: "var(--spark-lime)",
                          }}
                        >
                          OPEN
                        </Link>
                        <Link
                          to={`/requests/list?plan=${encodeURIComponent(plan.id)}`}
                          className="mono text-[9px]"
                          style={{
                            letterSpacing: "0.12em",
                            color: "rgba(255,255,255,0.45)",
                          }}
                        >
                          TRACKER
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compact cards for mobile-ish */}
      <div className="lg:hidden space-y-3">
        {filtered.map((plan) => {
          const health = planHealth(plan.pipeline);
          return (
            <Link
              key={`card-${plan.id}`}
              to={`/plans/${plan.uuid}`}
              className="spark-card block p-4"
            >
              <div className="flex justify-between gap-2 mb-2">
                <span className="font-semibold">{plan.name}</span>
                <span
                  className="mono text-[9px]"
                  style={{ color: health.color, letterSpacing: "0.1em" }}
                >
                  {health.label.toUpperCase()}
                </span>
              </div>
              <ActivationPlanPipelineStrip
                pipeline={plan.pipeline}
                compact
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default function PlansList() {
  const [refreshKey, setRefreshKey] = useState(0);
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
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              LEADERSHIP · FIELD PLANNING
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              All plans
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              Proposed vs staffed vs done across every activation slate.
              Ops still runs Tracker → Staffing → Today → Recap.
            </p>
          </div>
          {isAdmin ? (
            <CreatePlanForm
              onCreated={(uuid) => {
                bump();
                if (uuid) navigate(`/plans/${uuid}`);
              }}
            />
          ) : null}
        </div>

        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading plans…
            </div>
          }
        >
          <PortfolioInner refreshKey={refreshKey} />
        </Suspense>
      </div>
    </Layout>
  );
}
