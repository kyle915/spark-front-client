/**
 * Activation Plan detail — pipeline + deep-link into Master Tracker filtered
 * by this plan. Read-heavy leadership view; attach/detach via Tracker.
 */

import { Suspense, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAlertStore } from "@/store/alertStore";
import { ActivationPlanQuery } from "@/api/queries/ActivationPlanQuery";
import type { ActivationPlanQuery as ActivationPlanQueryType } from "@api/queries/__generated__/ActivationPlanQuery.graphql";
import {
  UpdateActivationPlanMutation,
} from "@/api/mutations/UpdateActivationPlanMutation";
import type { UpdateActivationPlanMutation as UpdateActivationPlanMutationType } from "@api/mutations/__generated__/UpdateActivationPlanMutation.graphql";
import {
  DeleteActivationPlanMutation,
} from "@/api/mutations/DeleteActivationPlanMutation";
import type { DeleteActivationPlanMutation as DeleteActivationPlanMutationType } from "@api/mutations/__generated__/DeleteActivationPlanMutation.graphql";
import ActivationPlanPipelineStrip from "@/plans/ActivationPlanPipelineStrip";

const PlanDetailInner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<ActivationPlanQueryType>(
    ActivationPlanQuery,
    { uuid },
    { fetchPolicy: "store-or-network" },
  );
  const plan = data.activationPlan;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plan?.name ?? "");
  const [brief, setBrief] = useState(plan?.conceptBrief ?? "");
  const [startDate, setStartDate] = useState(plan?.startDate ?? "");
  const [endDate, setEndDate] = useState(plan?.endDate ?? "");
  const [markets, setMarkets] = useState((plan?.markets ?? []).join(", "));

  const [commitUpdate, updating] =
    useMutation<UpdateActivationPlanMutationType>(UpdateActivationPlanMutation);
  const [commitDelete, deleting] =
    useMutation<DeleteActivationPlanMutationType>(DeleteActivationPlanMutation);

  if (!plan) {
    return (
      <div
        className="spark-card p-8 text-center"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Plan not found.{" "}
        <Link to="/plans" className="underline">
          Back to plans
        </Link>
      </div>
    );
  }

  const trackerHref = `/requests/list?plan=${encodeURIComponent(plan.id)}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    commitUpdate({
      variables: {
        input: {
          id: plan.id,
          name: name.trim() || null,
          conceptBrief: brief,
          startDate: startDate || null,
          endDate: endDate || null,
          markets: markets
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
        },
      },
      onCompleted: (resp) => {
        if (!resp.updateActivationPlan?.success) {
          showAlert(
            resp.updateActivationPlan?.message || "Update failed",
            "error",
          );
          return;
        }
        showAlert("Plan updated", "success");
        setEditing(false);
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const remove = () => {
    if (
      !window.confirm(
        `Delete plan “${plan.name}”? Requests stay; they are only detached.`,
      )
    ) {
      return;
    }
    commitDelete({
      variables: { input: { id: plan.id } },
      onCompleted: (resp) => {
        if (!resp.deleteActivationPlan?.success) {
          showAlert(
            resp.deleteActivationPlan?.message || "Delete failed",
            "error",
          );
          return;
        }
        showAlert("Plan deleted", "success");
        navigate("/plans");
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          to="/plans"
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          ← ALL PLANS
        </Link>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          {plan.name}
        </h1>
        <p
          className="mono text-[10px] mt-2"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {plan.requestCount} REQUEST{plan.requestCount === 1 ? "" : "S"}
          {plan.startDate || plan.endDate
            ? ` · ${plan.startDate ?? "…"} → ${plan.endDate ?? "…"}`
            : ""}
          {plan.markets.length > 0 ? ` · ${plan.markets.join(", ")}` : ""}
        </p>
        {plan.conceptBrief ? (
          <p className="mt-3" style={{ color: "rgba(255,255,255,0.65)" }}>
            {plan.conceptBrief}
          </p>
        ) : null}
      </div>

      <div className="spark-card p-5">
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          PIPELINE · PLANNED → VERIFIED
        </p>
        <ActivationPlanPipelineStrip pipeline={plan.pipeline} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to={trackerHref}
          className="btn btn-sm"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0a0a",
            border: "none",
          }}
        >
          Open in Master Tracker
        </Link>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setName(plan.name);
            setBrief(plan.conceptBrief);
            setStartDate(plan.startDate ?? "");
            setEndDate(plan.endDate ?? "");
            setMarkets(plan.markets.join(", "));
            setEditing((v) => !v);
          }}
        >
          {editing ? "Close edit" : "Edit"}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost text-error"
          disabled={deleting}
          onClick={remove}
        >
          Delete
        </button>
      </div>

      {editing ? (
        <form onSubmit={save} className="spark-card p-5 space-y-3">
          <input
            className="input input-bordered w-full bg-transparent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <textarea
            className="textarea textarea-bordered w-full bg-transparent"
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="input input-bordered w-full bg-transparent"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="input input-bordered w-full bg-transparent"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <input
            className="input input-bordered w-full bg-transparent"
            placeholder="Markets (comma-separated)"
            value={markets}
            onChange={(e) => setMarkets(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-sm"
            disabled={updating}
            style={{
              background: "var(--spark-lime)",
              color: "#0a0a0a",
              border: "none",
            }}
          >
            {updating ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
    </div>
  );
};

export default function PlanDetail() {
  const { uuid } = useParams<{ uuid: string }>();

  return (
    <Layout>
      {!uuid ? (
        <p style={{ color: "rgba(255,255,255,0.55)" }}>Missing plan id.</p>
      ) : (
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading plan…
            </div>
          }
        >
          <PlanDetailInner uuid={uuid} />
        </Suspense>
      )}
    </Layout>
  );
}
