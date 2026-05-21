/**
 * Admin actions on the custom recap view:
 *   - Generate / regenerate PDF (so the approval email has a fresh attachment)
 *   - Approve  → fires email to RMM + clients + original requestor with PDF
 *   - Decline  → marks approved=false (and notifies via the same path
 *                for the decline case, server-side decline mutation
 *                handles that)
 *
 * Lives at the top of /recap/view-custom/:uuid. Status badge in the
 * header reflects approved state; this is the action surface.
 */
import { useMutation } from "react-relay/hooks";
import { useAlertStore } from "@/store/alertStore";
import {
  ApproveCustomRecapMutation,
  DeclineCustomRecapMutation,
  GenerateCustomRecapPdfMutation,
} from "@/api/mutations/CustomRecapApprovalMutations";
import type { CustomRecapApprovalMutations_ApproveMutation } from "@/api/mutations/__generated__/CustomRecapApprovalMutations_ApproveMutation.graphql";
import type { CustomRecapApprovalMutations_DeclineMutation } from "@/api/mutations/__generated__/CustomRecapApprovalMutations_DeclineMutation.graphql";
import type { CustomRecapApprovalMutations_GeneratePdfMutation } from "@/api/mutations/__generated__/CustomRecapApprovalMutations_GeneratePdfMutation.graphql";

interface Props {
  recapId: string;
  approved: boolean;
}

export default function CustomRecapApprovalPanel({ recapId, approved }: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);

  const [commitApprove, approving] =
    useMutation<CustomRecapApprovalMutations_ApproveMutation>(
      ApproveCustomRecapMutation,
    );
  const [commitDecline, declining] =
    useMutation<CustomRecapApprovalMutations_DeclineMutation>(
      DeclineCustomRecapMutation,
    );
  const [commitPdf, generating] =
    useMutation<CustomRecapApprovalMutations_GeneratePdfMutation>(
      GenerateCustomRecapPdfMutation,
    );

  const busy = approving || declining || generating;

  const onApprove = () => {
    if (
      !confirm(
        approved
          ? "This is already approved — re-send the approval email to the requestor + RMM?"
          : "Approve this recap? An email with the recap PDF goes to the RMM, client team, and the original requestor.",
      )
    )
      return;
    commitApprove({
      variables: { input: { id: recapId, approved: true } },
      onCompleted: (resp) => {
        if (resp.approveCustomRecap?.success) {
          showAlert("Recap approved — email sent.", "success");
          window.location.reload();
        } else {
          showAlert(
            resp.approveCustomRecap?.message ?? "Approve failed.",
            "warning",
          );
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const onDecline = () => {
    if (!confirm("Decline this recap? The BA can resubmit edits.")) return;
    commitDecline({
      variables: { input: { id: recapId } },
      onCompleted: (resp) => {
        if (resp.declineCustomRecap?.success) {
          showAlert("Recap declined.", "success");
          window.location.reload();
        } else {
          showAlert(
            resp.declineCustomRecap?.message ?? "Decline failed.",
            "warning",
          );
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const onRegeneratePdf = () => {
    commitPdf({
      variables: { input: { id: recapId } },
      onCompleted: (resp) => {
        if (resp.generateCustomRecapPdf?.success) {
          showAlert("PDF regenerated.", "success");
        } else {
          showAlert(
            resp.generateCustomRecapPdf?.message ?? "PDF rebuild failed.",
            "warning",
          );
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div
      className="flex items-center gap-2 flex-wrap p-4 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          ADMIN ACTIONS
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          {approved
            ? "Recap is approved. Re-approving resends the email."
            : "Approving emails the RMM, client team, and the original requestor with the PDF attached."}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onRegeneratePdf}
          disabled={busy}
          className="px-3 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: "transparent",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {generating ? "Rebuilding…" : "↻ Rebuild PDF"}
        </button>
        {!approved && (
          <button
            onClick={onDecline}
            disabled={busy}
            className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: "transparent",
              border: "1px solid rgba(239,90,42,0.45)",
              color: "var(--spark-orange)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {declining ? "Declining…" : "✕ Decline"}
          </button>
        )}
        <button
          onClick={onApprove}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 18px rgba(197,245,70,0.35)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {approving
            ? "Approving…"
            : approved
              ? "✓ Resend approval email"
              : "✓ Approve & email"}
        </button>
      </div>
    </div>
  );
}
