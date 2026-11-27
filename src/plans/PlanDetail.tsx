/**
 * Activation Plan detail — calm hierarchy, primary Add request CTA,
 * progressive edit, status mix, attach + bulk detach.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { AnimatePresence, motion } from "framer-motion";
import Layout from "@/layout/Layout";
import SparkConfirm from "@/shared/SparkConfirm";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ActivationPlanQuery } from "@/api/queries/ActivationPlanQuery";
import type { ActivationPlanQuery as ActivationPlanQueryType } from "@api/queries/__generated__/ActivationPlanQuery.graphql";
import { PlanRequestsQuery } from "@/api/queries/PlanRequestsQuery";
import type { PlanRequestsQuery as PlanRequestsQueryType } from "@api/queries/__generated__/PlanRequestsQuery.graphql";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";
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
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkPrimaryButton, { SparkPrimaryLink } from "@/shared/SparkPrimaryButton";
import { SparkGhostButton, SparkGhostLink } from "@/shared/SparkGhostButton";
import "@/plans/plans.css";

type PlanRequestNode = NonNullable<
  NonNullable<
    NonNullable<PlanRequestsQueryType["response"]["requests"]>["edges"]
  >[number]
>["node"];

const STATUS_MIX: Array<{
  slug: string;
  label: string;
  color: string;
}> = [
  { slug: "pending", label: "Pending", color: "var(--spark-text-meta)" },
  { slug: "queue", label: "Queue", color: "var(--spark-text-meta)" },
  { slug: "approved", label: "Approved", color: "var(--spark-sky, #7dd3fc)" },
  { slug: "scheduled", label: "Scheduled", color: "rgba(var(--spark-accent-rgb),0.75)" },
  { slug: "done", label: "Done", color: "var(--spark-lime)" },
  { slug: "declined", label: "Declined", color: "var(--spark-orange)" },
];

const STATUS_COLOR: Record<string, string> = Object.fromEntries(
  STATUS_MIX.map((s) => [s.slug, s.color]),
);

const WINDOW_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  active: "Active",
  past: "Past",
  undated: "No dates",
};

function venueLabel(r: NonNullable<PlanRequestNode>): string {
  return r.retailer?.name || r.location?.name || r.name || r.address || "—";
}

const StatusMixBar: React.FC<{ rows: NonNullable<PlanRequestNode>[] }> = ({
  rows,
}) => {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const slug = (r.status?.slug ?? "pending").toLowerCase();
      map.set(slug, (map.get(slug) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const total = rows.length;
  if (total === 0) return null;

  const segments = STATUS_MIX.map((s) => ({
    ...s,
    count: counts.get(s.slug) ?? 0,
  })).filter((s) => s.count > 0);

  // Catch any unexpected slugs so the bar still adds to 100%.
  let known = 0;
  for (const s of segments) known += s.count;
  const other = total - known;
  if (other > 0) {
    segments.push({
      slug: "other",
      label: "Other",
      color: "var(--spark-text-meta)",
      count: other,
    });
  }

  return (
    <div className="mt-5">
      <div className="plans-status-mix" role="img" aria-label="Request status mix">
        {segments.map((s) => (
          <div
            key={s.slug}
            className="plans-status-mix-seg"
            style={{
              flexGrow: s.count,
              background: s.color,
            }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="plans-status-mix-legend">
        {segments.map((s) => (
          <span key={s.slug}>
            <i
              className="plans-status-mix-dot"
              style={{ background: s.color }}
              aria-hidden
            />
            {s.label} · {s.count}
          </span>
        ))}
      </div>
    </div>
  );
};

const OwnerPicker: React.FC<{
  tenantId: string;
  value: string;
  onChange: (id: string) => void;
}> = ({ tenantId, value, onChange }) => {
  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    { filters: { tenantId, role: "SPARK" }, first: 200 },
    { fetchPolicy: "store-or-network" },
  );
  const options = useMemo(() => {
    return (data.users?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .map((u) => ({
        id: u.id,
        label:
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.email ||
          "User",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  return (
    <select
      className="plans-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">No owner</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
};

const PlanRequestsRoster: React.FC<{
  planId: string;
  tenantId: string;
  refreshKey: number;
  canEdit: boolean;
  createHref: string;
  onChanged: () => void;
  onStatusRows?: (rows: NonNullable<PlanRequestNode>[]) => void;
}> = ({
  planId,
  tenantId,
  refreshKey,
  canEdit,
  createHref,
  onChanged,
  onStatusRows,
}) => {
  const { showAlert } = useAlertStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const statusSig = rows
    .map((r) => `${r.id}:${(r.status?.slug ?? "").toLowerCase()}`)
    .join("|");
  const statusSigRef = useRef("");
  useEffect(() => {
    if (statusSig === statusSigRef.current) return;
    statusSigRef.current = statusSig;
    onStatusRows?.(rows);
  }, [statusSig, rows, onStatusRows]);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const [pendingDetach, setPendingDetach] = useState<{ ids: string[]; label?: string } | null>(null);

  const detachIds = (ids: string[], label?: string) => {
    if (ids.length === 0) return;
    setPendingDetach({ ids, label });
  };

  const executeDetach = () => {
    if (!pendingDetach) return;
    const { ids } = pendingDetach;
    setPendingDetach(null);
    detachCommit({
      variables: { input: { requestIds: ids } },
      onCompleted: (resp) => {
        if (!resp.detachRequestsFromPlan?.success) {
          showAlert(
            resp.detachRequestsFromPlan?.message || "Detach failed",
            "error",
          );
          return;
        }
        showAlert(
          ids.length === 1 ? "Detached from plan" : `Detached ${ids.length}`,
          "success",
        );
        setSelected(new Set());
        onChanged();
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="spark-support mx-auto">
          No requests on this plan yet.
        </p>
        {canEdit ? (
          <SparkPrimaryLink to={createHref} className="mt-4 inline-flex">
            Add request
          </SparkPrimaryLink>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canEdit && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <SparkGhostButton
            disabled={detaching}
            onClick={() => detachIds([...selected])}
          >
            Detach {selected.size} selected
          </SparkGhostButton>
          <SparkGhostButton onClick={() => setSelected(new Set())}>
            Clear
          </SparkGhostButton>
        </div>
      ) : null}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left">
          <thead>
            <tr
              className="text-xs"
              style={{
                color: "var(--plan-faint)",
                borderBottom: "1px solid var(--spark-border)",
              }}
            >
              {canEdit ? (
                <th className="px-2 py-2.5 w-10">
                  <input
                    type="checkbox"
                    className="plans-roster-check"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all requests"
                  />
                </th>
              ) : null}
              <th className="px-2 py-2.5 font-medium">Date</th>
              <th className="px-2 py-2.5 font-medium">Venue</th>
              <th className="px-2 py-2.5 font-medium">Type</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium text-right">Recaps</th>
              {canEdit ? (
                <th className="px-2 py-2.5 font-medium text-right" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const slug = (r.status?.slug ?? "").toLowerCase();
              const dateLabel = requestDateKey(r.event?.date ?? r.date) ?? "—";
              const venue = venueLabel(r);
              const on = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: "1px solid var(--spark-border)",
                    background: on ? "rgba(var(--spark-accent-rgb),0.05)" : undefined,
                  }}
                >
                  {canEdit ? (
                    <td className="px-2 py-2.5">
                      <input
                        type="checkbox"
                        className="plans-roster-check"
                        checked={on}
                        onChange={() => toggle(r.id)}
                        aria-label={`Select ${venue}`}
                      />
                    </td>
                  ) : null}
                  <td
                    className="px-2 py-2.5 text-sm whitespace-nowrap"
                    style={{ color: "var(--plan-muted)" }}
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
                    className="px-2 py-2.5 text-sm"
                    style={{ color: "var(--plan-muted)" }}
                  >
                    {r.requestType?.name ?? "—"}
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: STATUS_COLOR[slug] ?? "var(--plan-muted)",
                      }}
                    >
                      {r.status?.name ?? (slug || "—")}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tab-num text-sm">
                    {r.recapsFiledCount ?? 0}
                  </td>
                  {canEdit ? (
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        className="text-xs"
                        disabled={detaching}
                        onClick={() => detachIds([r.id], venue)}
                        style={{ color: "var(--plan-faint)" }}
                      >
                        Detach
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pendingDetach ? (
        <SparkConfirm
          tone="danger"
          kicker="Activation plan"
          title={
            pendingDetach.ids.length === 1
              ? `Detach "${pendingDetach.label ?? "this request"}"?`
              : `Detach ${pendingDetach.ids.length} requests from this plan?`
          }
          body="The requests remain in the Master Tracker as unplanned."
          confirmLabel="Detach"
          busy={detaching}
          onConfirm={executeDetach}
          onCancel={() => setPendingDetach(null)}
        />
      ) : null}
    </div>
  );
};

const AttachUnplannedPanel: React.FC<{
  planId: string;
  tenantId: string;
  refreshKey: number;
  createHref: string;
  onAttached: () => void;
}> = ({ planId, tenantId, refreshKey, createHref, onAttached }) => {
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

  const allSelected =
    candidates.length > 0 && selected.size === candidates.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(candidates.map((r) => r.id)));
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
    <div className="space-y-3 plans-slide-down">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search unplanned requests…"
          className="plans-input"
          style={{ flex: 1, minWidth: 180 }}
        />
        {candidates.length > 0 ? (
          <SparkGhostButton onClick={toggleAll}>
            {allSelected ? "Clear all" : "Select all"}
          </SparkGhostButton>
        ) : null}
        <SparkPrimaryButton
          disabled={inFlight || selected.size === 0}
          onClick={attach}
        >
          {inFlight
            ? "Attaching…"
            : selected.size
              ? `Attach ${selected.size}`
              : "Attach"}
        </SparkPrimaryButton>
      </div>
      {candidates.length === 0 ? (
        <div className="text-center py-6 px-3">
          <p className="spark-support mx-auto">
            Nothing unplanned — create a request for this plan.
          </p>
          <SparkPrimaryLink to={createHref} className="mt-4 inline-flex">
            Add request
          </SparkPrimaryLink>
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {candidates.map((r) => {
            const venue = venueLabel(r);
            const dateLabel = requestDateKey(r.date) ?? "";
            const on = selected.has(r.id);
            return (
              <li key={r.id}>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                  style={{
                    background: on
                      ? "rgba(var(--spark-accent-rgb),0.08)"
                      : "transparent",
                    border: `1px solid ${
                      on ? "rgba(var(--spark-accent-rgb),0.35)" : "var(--spark-border)"
                    }`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(r.id)}
                    className="plans-roster-check"
                  />
                  <span className="text-sm flex-1 truncate">{venue}</span>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: "var(--plan-faint)" }}
                  >
                    {dateLabel}
                    {r.status?.slug
                      ? ` · ${(r.status.name ?? r.status.slug)}`
                      : ""}
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
  const [rosterRows, setRosterRows] = useState<NonNullable<PlanRequestNode>[]>(
    [],
  );

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
  const [editStep, setEditStep] = useState<1 | 2>(1);
  const [name, setName] = useState(plan?.name ?? "");
  const [brief, setBrief] = useState(plan?.conceptBrief ?? "");
  const [startDate, setStartDate] = useState(plan?.startDate ?? "");
  const [endDate, setEndDate] = useState(plan?.endDate ?? "");
  const [markets, setMarkets] = useState((plan?.markets ?? []).join(", "));
  const [ownerId, setOwnerId] = useState(plan?.ownerId ?? "");
  const [showAttach, setShowAttach] = useState(false);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState(false);

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
      <div className="spark-card text-center py-10">
        Plan not found.{" "}
        <Link to="/plans" className="underline">
          Back to plans
        </Link>
      </div>
    );
  }

  const trackerHref = `/requests/list?plan=${encodeURIComponent(plan.id)}`;
  const createHref = `/requests/create?plan=${encodeURIComponent(plan.id)}`;
  const health = planHealth(plan.pipeline);
  const windowKind = planWindowKind(plan.startDate, plan.endDate);
  const ownerLabel = plan.ownerName || plan.ownerEmail || null;

  const openEdit = () => {
    setName(plan.name);
    setBrief(plan.conceptBrief);
    setStartDate(plan.startDate ?? "");
    setEndDate(plan.endDate ?? "");
    setMarkets(plan.markets.join(", "));
    setOwnerId(plan.ownerId ?? "");
    setEditStep(1);
    setEditing(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const nextOwner = ownerId.trim();
    const prevOwner = plan.ownerId ?? "";
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
          ownerId: nextOwner || null,
          clearOwner: !nextOwner && Boolean(prevOwner),
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

  const executeRemovePlan = () => {
    setConfirmDeletePlan(false);
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

  const remove = () => {
    setConfirmDeletePlan(true);
  };

  return (
    <div className="plans-shell spark-fade-in">
      <div>
        <Link to="/plans" className="plans-back">
          ← All plans
        </Link>
        <SparkPageHeader
          className="mt-3"
          title={plan.name}
          support={
            <>
              {WINDOW_LABEL[windowKind] ?? windowKind} ·{" "}
              {formatPlanWindow(plan.startDate, plan.endDate)}
              {plan.markets.length > 0 ? ` · ${plan.markets.join(", ")}` : ""}
              {ownerLabel ? ` · ${ownerLabel}` : ""}
            </>
          }
          action={
            <span
              className="plans-health shrink-0"
              style={{ color: health.color }}
            >
              {health.label}
            </span>
          }
        />
        {plan.conceptBrief ? (
          <p className="mt-4 max-w-2xl" style={{ color: "var(--plan-muted)" }}>
            {plan.conceptBrief}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {isAdmin ? (
          <SparkPrimaryLink to={createHref}>Add request</SparkPrimaryLink>
        ) : null}
        <SparkGhostLink to={trackerHref}>Open in Tracker</SparkGhostLink>
        {isAdmin ? (
          <>
            <SparkGhostButton onClick={() => setShowAttach((v) => !v)}>
              {showAttach ? "Hide attach" : "Attach existing"}
            </SparkGhostButton>
            <SparkGhostButton
              onClick={() => {
                if (editing) setEditing(false);
                else openEdit();
              }}
            >
              {editing ? "Close edit" : "Edit"}
            </SparkGhostButton>
            <SparkGhostButton
              disabled={deleting}
              onClick={remove}
              style={{ color: "var(--spark-orange)" }}
            >
              Delete
            </SparkGhostButton>
          </>
        ) : null}
      </div>

      <div className="spark-card">
        <p className="text-sm mb-4" style={{ color: "var(--plan-muted)" }}>
          {plan.requestCount} request{plan.requestCount === 1 ? "" : "s"} on this
          plan
        </p>
        <ActivationPlanPipelineStrip pipeline={plan.pipeline} />
        <StatusMixBar rows={rosterRows} />
      </div>

      <AnimatePresence>
        {editing && isAdmin ? (
          <motion.form
            key="edit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={save}
            className="spark-card space-y-4 max-w-lg"
          >
            <div>
              <h2 className="spark-title text-xl font-semibold">Edit plan</h2>
              <p className="spark-support mt-1 text-sm">
                {editStep === 1
                  ? "Name and brief."
                  : "Window, markets, and owner."}
              </p>
            </div>
            {editStep === 1 ? (
              <div className="space-y-3">
                <input
                  className="plans-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
                <textarea
                  className="plans-input min-h-[72px]"
                  placeholder="Concept brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                />
              </div>
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
                <label className="text-sm space-y-1.5 block">
                  <span style={{ color: "var(--plan-muted)" }}>Owner</span>
                  {tenantId ? (
                    <Suspense
                      fallback={
                        <select className="plans-input" disabled>
                          <option>Loading…</option>
                        </select>
                      }
                    >
                      <OwnerPicker
                        tenantId={tenantId}
                        value={ownerId}
                        onChange={setOwnerId}
                      />
                    </Suspense>
                  ) : null}
                </label>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {editStep === 1 ? (
                <>
                  <SparkPrimaryButton
                    disabled={!name.trim()}
                    onClick={() => setEditStep(2)}
                  >
                    Continue
                  </SparkPrimaryButton>
                  <SparkGhostButton onClick={() => setEditing(false)}>
                    Cancel
                  </SparkGhostButton>
                </>
              ) : (
                <>
                  <SparkPrimaryButton
                    type="submit"
                    disabled={updating || !name.trim()}
                  >
                    {updating ? "Saving…" : "Save"}
                  </SparkPrimaryButton>
                  <SparkGhostButton onClick={() => setEditStep(1)}>
                    Back
                  </SparkGhostButton>
                </>
              )}
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {showAttach && isAdmin && tenantId ? (
        <div className="spark-card space-y-3">
          <h2 className="spark-title text-lg font-semibold">
            Attach existing requests
          </h2>
          <p className="text-sm" style={{ color: "var(--plan-muted)" }}>
            Pull unplanned Tracker rows onto this slate.
          </p>
          <Suspense
            fallback={
              <p className="text-sm" style={{ color: "var(--plan-muted)" }}>
                Loading…
              </p>
            }
          >
            <AttachUnplannedPanel
              planId={plan.id}
              tenantId={tenantId}
              refreshKey={refreshKey}
              createHref={createHref}
              onAttached={bump}
            />
          </Suspense>
        </div>
      ) : null}

      <div className="spark-card">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="spark-title text-lg font-semibold">Requests</h2>
          <Link
            to={trackerHref}
            className="text-sm"
            style={{ color: "var(--spark-lime)" }}
          >
            Full Tracker
          </Link>
        </div>
        {tenantId ? (
          <Suspense
            fallback={
              <p className="text-sm" style={{ color: "var(--plan-muted)" }}>
                Loading requests…
              </p>
            }
          >
            <PlanRequestsRoster
              planId={plan.id}
              tenantId={tenantId}
              refreshKey={refreshKey}
              canEdit={isAdmin}
              createHref={createHref}
              onChanged={bump}
              onStatusRows={setRosterRows}
            />
          </Suspense>
        ) : null}
      </div>
      {confirmDeletePlan ? (
        <SparkConfirm
          tone="danger"
          kicker="Delete plan"
          title={`Delete plan "${plan.name}"?`}
          body="Requests stay in the tracker; they are only detached from this plan."
          confirmLabel="Delete plan"
          busy={deleting}
          onConfirm={executeRemovePlan}
          onCancel={() => setConfirmDeletePlan(false)}
        />
      ) : null}
    </div>
  );
};

export default function PlanDetail() {
  const { uuid } = useParams<{ uuid: string }>();

  return (
    <Layout>
      {!uuid ? (
        <p style={{ color: "var(--plan-muted)" }}>Missing plan id.</p>
      ) : (
        <Suspense
          fallback={
            <div
              className="plans-shell"
            >
              <div
                className="spark-card text-center text-sm py-10"
                style={{ color: "var(--plan-muted)" }}
              >
                Loading plan…
              </div>
            </div>
          }
        >
          <PlanDetailInner uuid={uuid} />
        </Suspense>
      )}
    </Layout>
  );
}
