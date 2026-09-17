/**
 * Admin Activation Plans list — FMM forward slates that group Requests.
 * Leadership-readable; create/edit stay light (name, window, markets, brief).
 */

import { Suspense, useState } from "react";
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
import { ActivationPlansQuery } from "@/api/queries/ActivationPlansQuery";
import type { ActivationPlansQuery as ActivationPlansQueryType } from "@api/queries/__generated__/ActivationPlansQuery.graphql";
import {
  CreateActivationPlanMutation,
} from "@/api/mutations/CreateActivationPlanMutation";
import type { CreateActivationPlanMutation as CreateActivationPlanMutationType } from "@api/mutations/__generated__/CreateActivationPlanMutation.graphql";
import ActivationPlanPipelineStrip from "@/plans/ActivationPlanPipelineStrip";

const PlansListInner: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
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

  if (plans.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        No activation plans yet. Create one to group requests off Sheets.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <Link
          key={plan.id}
          to={`/plans/${plan.uuid}`}
          className="spark-card block p-5 hover:brightness-110 transition"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2
                className="display text-xl font-bold truncate"
                style={{ letterSpacing: "-0.03em" }}
              >
                {plan.name}
              </h2>
              <p
                className="mono text-[10px] mt-1"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {plan.requestCount} REQUEST
                {plan.requestCount === 1 ? "" : "S"}
                {plan.startDate || plan.endDate
                  ? ` · ${plan.startDate ?? "…"} → ${plan.endDate ?? "…"}`
                  : ""}
                {plan.markets.length > 0
                  ? ` · ${plan.markets.join(", ")}`
                  : ""}
              </p>
              {plan.conceptBrief ? (
                <p
                  className="mt-2 text-sm line-clamp-2"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {plan.conceptBrief}
                </p>
              ) : null}
            </div>
            <span
              className="mono text-[10px] shrink-0"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-lime)",
              }}
            >
              OPEN →
            </span>
          </div>
          <ActivationPlanPipelineStrip pipeline={plan.pipeline} compact />
        </Link>
      ))}
    </div>
  );
};

const CreatePlanForm: React.FC<{
  onCreated: () => void;
}> = ({ onCreated }) => {
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
        setName("");
        setBrief("");
        setStartDate("");
        setEndDate("");
        setMarkets("");
        setOpen(false);
        onCreated();
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
    <form
      onSubmit={submit}
      className="spark-card p-5 space-y-3 max-w-xl"
    >
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
      />
      <textarea
        className="textarea textarea-bordered w-full bg-transparent"
        placeholder="Concept brief (optional)"
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
          {inFlight ? "Saving…" : "Create"}
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

export default function PlansList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const environment = useRelayEnvironment();
  const { tenantId } = useAuthStore();
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
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              FIELD PLANNING · LEADERSHIP
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Activation Plans
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              Named forward slates that group requests. Ops still runs through
              Tracker → Staffing → Today → Recap.
            </p>
          </div>
          <CreatePlanForm
            onCreated={() => {
              bump();
              navigate("/plans");
            }}
          />
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
          <PlansListInner refreshKey={refreshKey} />
        </Suspense>
      </div>
    </Layout>
  );
}
