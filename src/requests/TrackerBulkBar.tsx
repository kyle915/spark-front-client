import { Suspense, useState } from "react";
import { useMutation } from "react-relay/hooks";
import { BulkAssignAmbassadorMutation } from "@/api/mutations/BulkAssignAmbassadorMutation";
import type { BulkAssignAmbassadorMutation as BulkAssignType } from "@api/mutations/__generated__/BulkAssignAmbassadorMutation.graphql";
import { BulkBaPicker } from "@/components/pages/staffing/SparkStaffingBoard";
import { useAlertStore } from "@/store/alertStore";
import { bulkTargets, type BulkRow } from "./trackerBulkTargets";

const APPROVE_MUTATION =
  "mutation Approve($input: ApproveRequestInput!) { approveRequest(input: $input) { success message } }";

async function approveOne(id: string): Promise<boolean> {
  try {
    const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
      },
      body: JSON.stringify({ query: APPROVE_MUTATION, variables: { input: { id } } }),
    });
    const json = await res.json();
    return !json.errors?.length && Boolean(json?.data?.approveRequest?.success);
  } catch {
    return false;
  }
}

const btn: React.CSSProperties = {
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
  background: "transparent",
};

/**
 * Bulk actions for the rows ticked on the Master Tracker: approve every
 * pending request, or book one ambassador onto every selected event. Uses
 * the same server calls as the single-row buttons, so permissions and
 * emails behave identically. Sits beside the plan bar.
 */
export const TrackerBulkBar: React.FC<{
  rows: BulkRow[];
  onDone: () => void;
}> = ({ rows, onDone }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const { approvable, assignable } = bulkTargets(rows);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [approving, setApproving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [commitAssign, assigning] = useMutation<BulkAssignType>(BulkAssignAmbassadorMutation);

  const runApprove = async () => {
    setConfirmApprove(false);
    setApproving(true);
    let ok = 0;
    for (const r of approvable) {
      if (await approveOne(r.id)) ok += 1;
    }
    setApproving(false);
    const failed = approvable.length - ok;
    showAlert(
      failed === 0
        ? `Approved ${ok} request${ok === 1 ? "" : "s"}.`
        : `Approved ${ok}. ${failed} could not be approved — try those again.`,
      failed === 0 ? "success" : "error",
    );
    if (ok > 0) onDone();
  };

  const runAssign = (ambassadorId: string, name: string) => {
    const eventIds = assignable.map((r) => r.eventId as string);
    commitAssign({
      variables: { input: { ambassadorId, eventIds } },
      onCompleted: (res) => {
        const r = res.bulkAssignAmbassadorToEvents;
        setPickerOpen(false);
        showAlert(
          r?.message ||
            `Assigned ${name} to ${eventIds.length} event${eventIds.length === 1 ? "" : "s"}.`,
          r?.success ? "success" : "error",
        );
        if (r?.success) onDone();
      },
      onError: () => {
        setPickerOpen(false);
        showAlert("Couldn't assign. Please try again.", "error");
      },
    });
  };

  if (rows.length === 0) return null;

  return (
    <div
      className="spark-card p-3 flex items-center gap-2 flex-wrap text-sm"
      role="region"
      aria-label="Bulk actions for selected events"
    >
      <span className="font-semibold">{rows.length} selected</span>
      {confirmApprove ? (
        <>
          <span>
            Approve {approvable.length} pending request
            {approvable.length === 1 ? "" : "s"}? Each sends its usual
            confirmation email.
          </span>
          <button
            type="button"
            onClick={() => void runApprove()}
            className="px-3 py-1.5 rounded-xl font-semibold"
            style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
          >
            Yes, approve
          </button>
          <button
            type="button"
            onClick={() => setConfirmApprove(false)}
            className="underline"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setConfirmApprove(true)}
            disabled={approving || approvable.length === 0}
            title={
              approvable.length === 0
                ? "None of the selected rows are pending approval"
                : undefined
            }
            className="px-3 py-1.5 rounded-xl font-semibold disabled:opacity-50"
            style={btn}
          >
            {approving ? "Approving…" : `Approve (${approvable.length})`}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={assigning || assignable.length === 0}
            title={
              assignable.length === 0
                ? "None of the selected rows have an event to staff yet"
                : undefined
            }
            className="px-3 py-1.5 rounded-xl font-semibold disabled:opacity-50"
            style={btn}
          >
            Assign ambassador ({assignable.length})
          </button>
        </>
      )}
      {pickerOpen ? (
        <Suspense fallback={null}>
          <BulkBaPicker
            count={assignable.length}
            busy={assigning}
            onPick={runAssign}
            onClose={() => setPickerOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default TrackerBulkBar;
