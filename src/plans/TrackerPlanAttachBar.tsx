/**
 * Master Tracker selection bar — Add selected rows to a plan, or Remove
 * them when the tracker is scoped with ?plan=.
 */

import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { ActivationPlansQuery } from "@/api/queries/ActivationPlansQuery";
import type { ActivationPlansQuery as ActivationPlansQueryType } from "@api/queries/__generated__/ActivationPlansQuery.graphql";
import { AttachRequestsToPlanMutation } from "@/api/mutations/AttachRequestsToPlanMutation";
import type { AttachRequestsToPlanMutation as AttachRequestsToPlanMutationType } from "@api/mutations/__generated__/AttachRequestsToPlanMutation.graphql";
import { DetachRequestsFromPlanMutation } from "@/api/mutations/DetachRequestsFromPlanMutation";
import type { DetachRequestsFromPlanMutation as DetachRequestsFromPlanMutationType } from "@api/mutations/__generated__/DetachRequestsFromPlanMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

function PlanPickerInner({
  tenantId,
  value,
  onChange,
}: {
  tenantId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const data = useLazyLoadQuery<ActivationPlansQueryType>(
    ActivationPlansQuery,
    { tenantId, first: 200 },
    { fetchPolicy: "store-or-network" },
  );
  const plans = data.activationPlans ?? [];
  if (plans.length === 0) {
    return (
      <span
        className="text-xs"
        style={{ color: "var(--spark-text-meta)" }}
      >
        No plans yet — create one under Plans.
      </span>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl text-xs"
      style={{
        padding: "0.45rem 0.9rem",
        background: "var(--spark-bg)",
        border: "1px solid var(--spark-border)",
        color: "var(--spark-text)",
        outline: "none",
        maxWidth: 240,
      }}
    >
      <option value="">Choose plan…</option>
      {plans.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export default function TrackerPlanAttachBar({
  tenantId,
  planId,
  selectedIds,
  onClear,
  onDone,
}: {
  tenantId: string;
  planId: string | null;
  selectedIds: string[];
  onClear: () => void;
  onDone: () => void;
}) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [pickedPlanId, setPickedPlanId] = useState("");
  const [commitAttach, attaching] =
    useMutation<AttachRequestsToPlanMutationType>(AttachRequestsToPlanMutation);
  const [commitDetach, detaching] =
    useMutation<DetachRequestsFromPlanMutationType>(
      DetachRequestsFromPlanMutation,
    );

  const targetPlanId = planId || pickedPlanId || null;
  const busy = attaching || detaching;
  const count = selectedIds.length;

  const label = useMemo(() => {
    if (count === 0) return null;
    return `${count} selected`;
  }, [count]);

  if (count === 0) return null;

  const attach = () => {
    if (!targetPlanId || selectedIds.length === 0) return;
    commitAttach({
      variables: {
        input: {
          activationPlanId: targetPlanId,
          requestIds: selectedIds,
        },
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
          `Added ${resp.attachRequestsToPlan.updatedCount} to plan`,
          "success",
        );
        onClear();
        onDone();
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const detach = () => {
    if (selectedIds.length === 0) return;
    commitDetach({
      variables: { input: { requestIds: selectedIds } },
      onCompleted: (resp) => {
        if (!resp.detachRequestsFromPlan?.success) {
          showAlert(
            resp.detachRequestsFromPlan?.message || "Remove failed",
            "error",
          );
          return;
        }
        showAlert(
          `Removed ${resp.detachRequestsFromPlan.updatedCount} from plan`,
          "success",
        );
        onClear();
        onDone();
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl"
      style={{
        background: "rgba(var(--spark-accent-rgb),0.06)",
        border: "1px solid rgba(var(--spark-accent-rgb),0.22)",
      }}
    >
      <span
        className="mono text-[10px]"
        style={{ letterSpacing: "0.14em", color: "var(--spark-lime)" }}
      >
        {label?.toUpperCase()}
      </span>
      {!planId ? (
        <Suspense fallback={null}>
          <PlanPickerInner
            tenantId={tenantId}
            value={pickedPlanId}
            onChange={setPickedPlanId}
          />
        </Suspense>
      ) : null}
      <button
        type="button"
        disabled={busy || !targetPlanId}
        onClick={attach}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
        style={{
          background: targetPlanId ? "var(--spark-lime)" : "transparent",
          color: targetPlanId ? "var(--spark-on-accent)" : "rgba(var(--spark-ink-rgb),0.4)",
          border: targetPlanId
            ? "none"
            : "1px solid var(--spark-border)",
        }}
      >
        {attaching
          ? "Adding…"
          : planId
            ? `Add to this plan`
            : "Add to plan"}
      </button>
      {planId ? (
        <button
          type="button"
          disabled={busy}
          onClick={detach}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
          style={{
            background: "transparent",
            color: "var(--spark-text-secondary)",
            border: "1px solid var(--spark-border)",
          }}
        >
          {detaching ? "Removing…" : "Remove from plan"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={onClear}
        className="mono text-[10px] ml-auto"
        style={{
          letterSpacing: "0.12em",
          color: "var(--spark-text-meta)",
          background: "transparent",
          border: "none",
        }}
      >
        CLEAR
      </button>
    </div>
  );
}
