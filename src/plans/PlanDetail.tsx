/**
 * Activation Plan detail — pipeline, request roster, attach unplanned
 * requests, deep-link to Tracker. Leadership reads; admins edit/attach.
 */

import { Suspense, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import Layout from "@/layout/Layout";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ActivationPlanQuery } from "@/api/queries/ActivationPlanQuery";
import type { ActivationPlanQuery as ActivationPlanQueryType } from "@api/queries/__generated__/ActivationPlanQuery.graphql";
import { PlanRequestsQuery } from "@/api/queries/PlanRequestsQuery";
import type { PlanRequestsQuery as PlanRequestsQueryType } from "@api/queries/__generated__/PlanRequestsQuery.graphql";
import { UpdateActivationPlanMutation } from "@/api/mutations/UpdateActivationPlanMutation";
import type { UpdateActivationPlanMutation as UpdateActivationPlanMutationType } from "@api/mutations/__generated__/UpdateActivationPlanMutation.graphql";
import { DeleteActivationPlanMutation } from "@/api/mutations/DeleteActivationPlanMutation";
import type { DeleteActivationPlanMutation as DeleteActivationPlanMutationType } from "@api/mutations/__generated__/DeleteActivationPlanMutation.graphql";
import { AttachRequestsToPlanMutation } from "@/api/mutations/AttachRequestsToPlanMutation";
import type { AttachRequestsToPlanMutation as AttachRequestsToPlanMutationType } from "@api/mutations/__generated__/AttachRequestsToPlanMutation.graphql";
import { DetachRequestsFromPlanMutation } from "@/api/mutations/DetachRequestsFromPlanMutation";
import type { DetachRequestsFromPlanMutation as DetachRequestsFromPlanMutationType } from "@api/mutations/__generated__/DetachRequestsFromPlanMutation.graphql";
import ActivationPlanPipelineStrip from "@/plans/ActivationPlanPipelineStrip";
import {
  formatPlanWindow,
  planHealth,
  planWindowKind,
} from "@/plans/planHealth";
import { requestDateKey } from "@/lib/requestDateKey";

const STATUS_COLOR: Record<string, string> = {
  pending: "rgba(255,255,255,0.55)",
  queue: "rgba(255,255,255,0.55)",
  approved: "var(--spark-sky, #7dd3fc)",
  scheduled: "var(--spark-lime)",
  done: "var(--spark-lime)",
  declined: "var(--spark-orange)",
};

const PlanRequestsTable: React.FC<{
  planId: string;
  tenantId: string;
  refreshKey: number;
  canEdit: boolean;
  onChanged: () => void;
}> = ({ planId, tenantId, refreshKey, canEdit, onChanged }) => {
  const { showAlert } = useAlertStore();
  const [detachCommit, detaching] =
    useMutation<DetachRequestsFromPlanMutationType>(
      DetachRequestsFromPlanMutation,
    );
  const data = useLazyLoadQuery<PlanRequestsQueryType>(
    PlanRequestsQuery,
    {
      first: 200,
      filters: {
        tenantId,
        activationPlanId: planId,
        dateSort: "asc",
      },
    },
    {
      fetchPolicy: refreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: `plan-reqs|${planId}|${refreshKey}`,
    },
  );
  const rows =
    data.requests?.edges
      ?.map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

  if (rows.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: "rgba(255,255,255,0.45)" }}>
        No requests on this plan yet.
        {canEdit ? " Attach unplanned requests below." : ""}
      </p>
    );
  }

  const detach = (requestId: string, label: string) => {
    if (!window.confirm(`Detach “${label}” from this plan?`)) return;
    detachCommit({
      variables: { input: { requestIds: [requestId] } },
      onCompleted: (resp) => {
        if (!resp.detachRequestsFromPlan?.success) {
          showAlert(
            resp.detachRequestsFromPlan?.message || "Detach failed",
            "error",
          );
          return;
        }
        showAlert("Detached from plan", "success");
        onChanged();
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left">
        <thead>
          <tr
            className="mono text-[9px]"
            style={{
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.4)",
              borderBottom: "1px solid var(--spark-border)",
            }}
          >
            <th className="px-2 py-2 font-normal">DATE</th>
            <th className="px-2 py-2 font-normal">VENUE</th>
            <th className="px-2 py-2 font-normal">TYPE</th>
            <th className="px-2 py-2 font-normal">STATUS</th>
            <th className="px-2 py-2 font-normal text-right">RECAPS</th>
            {canEdit ? (
              <th className="px-2 py-2 font-normal text-right" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const slug = (r.status?.slug ?? "").toLowerCase();
            const dateLabel = requestDateKey(r.event?.date ?? r.date) ?? "—";
            const venue =
              r.retailer?.name ||
              r.location?.name ||
              r.name ||
              r.address ||
              "—";
            return (
              <tr
                key={r.id}
                style={{ borderBottom: "1px solid var(--spark-border)" }}
              >
                <td
                  className="px-2 py-2.5 text-xs whitespace-nowrap"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {dateLabel}
                </td>
                <td className="px-2 py-2.5 text-sm">
                  <Link
                    to={`/request/view/${r.uuid}`}
                    className="hover:underline"
                  >
                    {venue}
                  </Link>
                </td>
                <td
                  className="px-2 py-2.5 text-xs"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {r.requestType?.name ?? "—"}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className="mono text-[9px]"
                    style={{
                      letterSpacing: "0.1em",
                      color: STATUS_COLOR[slug] ?? "rgba(255,255,255,0.55)",
                    }}
                  >
                    {((r.status?.name ?? slug) || "—").toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tab-num text-sm">
                  {r.recapsFiledCount ?? 0}
                </td>
                {canEdit ? (
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      className="mono text-[9px]"
                      disabled={detaching}
                      onClick={() => detach(r.id, venue)}
                      style={{
                        letterSpacing: "0.1em",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      DETACH
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const AttachUnplannedPanel: React.FC<{
  planId: string;
  tenantId: string;
  refreshKey: number;
  onAttached: () => void;
}> = ({ planId, tenantId, refreshKey, onAttached }) => {
  const { showAlert } = useAlertStore();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [commit, inFlight] =
    useMutation<AttachRequestsToPlanMutationType>(AttachRequestsToPlanMutation);

  const data = useLazyLoadQuery<PlanRequestsQueryType>(
    PlanRequestsQuery,
    {
      first: 50,
      q: q.trim() || null,
      filters: {
        tenantId,
        hasActivationPlan: false,
        dateSort: "asc",
        statusSlugs: ["pending", "queue", "approved", "scheduled"],
      },
    },
    {
      fetchPolicy: "store-or-network",
      fetchKey: `unplanned|${tenantId}|${q}|${refreshKey}`,
    },
  );
  const candidates =
    data.requests?.edges
      ?.map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const attach = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    commit({
      variables: {
        input: { activationPlanId: planId, requestIds: ids },
      },
      onCompleted: (resp) => {
        if (!resp.attachRequestsToPlan?.success) {
          showAlert(
            resp.attachRequestsToPlan?.message || "Attach failed",
            "error",
          );
          return;
        }
        showAlert(
          `Attached ${resp.attachRequestsToPlan.updatedCount} request(s)`,
          "success",
        );
        setSelected(new Set());
        onAttached();
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search unplanned requests…"
          className="input input-bordered input-sm bg-transparent flex-1 min-w-[180px]"
        />
        <button
          type="button"
          className="btn btn-sm"
          disabled={inFlight || selected.size === 0}
          onClick={attach}
          style={{
            background: selected.size ? "var(--spark-lime)" : "transparent",
            color: selected.size ? "#0a0a0a" : "rgba(255,255,255,0.4)",
            border: "1px solid var(--spark-border)",
          }}
        >
          {inFlight
            ? "Attaching…"
            : `Attach ${selected.size || ""}`.trim()}
        </button>
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          No unplanned active requests found.
        </p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {candidates.map((r) => {
            const venue =
              r.retailer?.name || r.location?.name || r.name || "Request";
            const dateLabel = requestDateKey(r.date) ?? "";
            const on = selected.has(r.id);
            return (
              <li key={r.id}>
                <label
                  className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer"
                  style={{
                    background: on
                      ? "rgba(197,245,70,0.08)"
                      : "transparent",
                    border: `1px solid ${
                      on ? "rgba(197,245,70,0.35)" : "var(--spark-border)"
                    }`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(r.id)}
                    className="checkbox checkbox-sm"
                  />
                  <span className="text-sm flex-1 truncate">{venue}</span>
                  <span
                    className="mono text-[9px] shrink-0"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {dateLabel} · {(r.status?.slug ?? "").toUpperCase()}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const PlanDetailInner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  const environment = useRelayEnvironment();
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useLazyLoadQuery<ActivationPlanQueryType>(
    ActivationPlanQuery,
    { uuid },
    {
      fetchPolicy: refreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: `plan|${uuid}|${refreshKey}`,
    },
  );
  const plan = data.activationPlan;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plan?.name ?? "");
  const [brief, setBrief] = useState(plan?.conceptBrief ?? "");
  const [startDate, setStartDate] = useState(plan?.startDate ?? "");
  const [endDate, setEndDate] = useState(plan?.endDate ?? "");
  const [markets, setMarkets] = useState((plan?.markets ?? []).join(", "));
  const [showAttach, setShowAttach] = useState(false);

  const [commitUpdate, updating] =
    useMutation<UpdateActivationPlanMutationType>(UpdateActivationPlanMutation);
  const [commitDelete, deleting] =
    useMutation<DeleteActivationPlanMutationType>(DeleteActivationPlanMutation);

  const bump = () => {
    if (!plan) {
      setRefreshKey((k) => k + 1);
      return;
    }
    fetchQuery(environment, ActivationPlanQuery, { uuid }).subscribe({
      complete: () => setRefreshKey((k) => k + 1),
      error: () => setRefreshKey((k) => k + 1),
    });
  };

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
  const health = planHealth(plan.pipeline);
  const windowKind = planWindowKind(plan.startDate, plan.endDate);

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
        bump();
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

  const ownerLabel = plan.ownerName || plan.ownerEmail || null;

  return (
    <div className="space-y-6 max-w-4xl">
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
        <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
          <div>
            <h1
              className="display text-4xl font-bold"
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
              {windowKind.toUpperCase()} ·{" "}
              {formatPlanWindow(plan.startDate, plan.endDate).toUpperCase()}
              {plan.markets.length > 0
                ? ` · ${plan.markets.join(", ")}`
                : ""}
              {ownerLabel ? ` · ${ownerLabel}` : ""}
            </p>
          </div>
          <span
            className="mono text-[9px] px-2.5 py-1.5 rounded-full"
            style={{
              letterSpacing: "0.12em",
              color: health.color,
              border: `1px solid ${health.color}`,
            }}
          >
            {health.label.toUpperCase()}
          </span>
        </div>
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
          PIPELINE · {plan.requestCount} REQUEST
          {plan.requestCount === 1 ? "" : "S"}
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
        {isAdmin ? (
          <>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowAttach((v) => !v)}
            >
              {showAttach ? "Hide attach" : "+ Attach requests"}
            </button>
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
          </>
        ) : null}
      </div>

      {editing && isAdmin ? (
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

      {showAttach && isAdmin && tenantId ? (
        <div className="spark-card p-5 space-y-3">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ATTACH UNPLANNED REQUESTS
          </p>
          <Suspense
            fallback={
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                Loading…
              </p>
            }
          >
            <AttachUnplannedPanel
              planId={plan.id}
              tenantId={tenantId}
              refreshKey={refreshKey}
              onAttached={bump}
            />
          </Suspense>
        </div>
      ) : null}

      <div className="spark-card p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            REQUESTS ON THIS PLAN
          </p>
          <Link
            to={trackerHref}
            className="mono text-[9px]"
            style={{ letterSpacing: "0.12em", color: "var(--spark-lime)" }}
          >
            FULL TRACKER →
          </Link>
        </div>
        {tenantId ? (
          <Suspense
            fallback={
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                Loading requests…
              </p>
            }
          >
            <PlanRequestsTable
              planId={plan.id}
              tenantId={tenantId}
              refreshKey={refreshKey}
              canEdit={isAdmin}
              onChanged={bump}
            />
          </Suspense>
        ) : null}
      </div>
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
