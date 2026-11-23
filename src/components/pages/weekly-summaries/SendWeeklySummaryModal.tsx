import { useEffect, useState, type ReactNode } from "react";
import { useMutation } from "react-relay/hooks";
import { SendWeeklyClientSummaryMutation } from "@/api/mutations/WeeklyClientSummaryMutations";
import type { WeeklyClientSummaryMutationsSendMutation } from "@/api/mutations/__generated__/WeeklyClientSummaryMutationsSendMutation.graphql";
import { EMAIL_RE, parseRecipients } from "@/utils/emailRecipients";
import { useAlertStore } from "@/store/alertStore";
import { SparkSheet } from "@/shared/SparkSheet";

/**
 * Staff send dialog for Client summaries — branded HTML email to brand
 * recipients (replaces the blank mailto: "Open in email" link).
 */

type Props = {
  summaryId: string;
  tenantName: string;
  periodLabel: string;
  suggestedRecipients: readonly string[];
  onClose: () => void;
  onSent: (summary: NonNullable<
    WeeklyClientSummaryMutationsSendMutation["response"]["sendWeeklyClientSummary"]["summary"]
  >) => void;
};

function useIsMobileSheet() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

export default function SendWeeklySummaryModal({
  summaryId,
  tenantName,
  periodLabel,
  suggestedRecipients,
  onClose,
  onSent,
}: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const mobile = useIsMobileSheet();
  const [recipientsRaw, setRecipientsRaw] = useState(
    suggestedRecipients.join(", "),
  );
  const [note, setNote] = useState("");
  const [sentTo, setSentTo] = useState<number | null>(null);

  const [commitSend, isSending] =
    useMutation<WeeklyClientSummaryMutationsSendMutation>(
      SendWeeklyClientSummaryMutation,
    );

  const sendEmail = () => {
    const recipients = parseRecipients(recipientsRaw);
    if (recipients.length === 0) {
      showAlert("Add at least one recipient email.", "warning");
      return;
    }
    const bad = recipients.find((e) => !EMAIL_RE.test(e));
    if (bad) {
      showAlert(`"${bad}" doesn't look like an email address.`, "warning");
      return;
    }
    commitSend({
      variables: {
        id: summaryId,
        recipients,
        message: note.trim() || null,
      },
      onCompleted: (resp) => {
        const r = resp.sendWeeklyClientSummary;
        if (r?.ok && r.summary) {
          const n = r.sentCount ?? recipients.length;
          setSentTo(n);
          onSent(r.summary);
          showAlert(
            `Summary emailed to ${n} recipient${n === 1 ? "" : "s"}.`,
            "success",
          );
        } else {
          showAlert(r?.reason || "Couldn't send the summary.", "error");
        }
      },
      onError: (err) => {
        showAlert(err.message || "Couldn't send the summary.", "error");
      },
    });
  };

  const body: ReactNode = (
    <div className="space-y-5">
      <div>
        <p
          className="mono text-[10px] mb-2"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          EMAIL TO BRAND
        </p>
        {sentTo === null ? (
          <div className="space-y-2">
            <input
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              placeholder="name@brand.com, teammate@brand.com"
              autoFocus={!mobile}
              className="w-full rounded-xl text-sm"
              style={{
                padding: "0.6rem 0.85rem",
                minHeight: 44,
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                outline: "none",
              }}
            />
            <p className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
              Prefills this brand's recap recipients and client users. Edit
              before sending.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a short note (optional)"
              rows={2}
              className="w-full rounded-xl text-sm resize-none"
              style={{
                padding: "0.6rem 0.85rem",
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                outline: "none",
              }}
            />
          </div>
        ) : (
          <div
            className="rounded-xl p-4 text-sm"
            style={{
              background: "rgba(var(--spark-accent-rgb),0.08)",
              border: "1px solid rgba(var(--spark-accent-rgb),0.3)",
              color: "var(--spark-lime)",
            }}
          >
            ✓ Sent to {sentTo} recipient{sentTo === 1 ? "" : "s"} — branded
            HTML for {periodLabel}.
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 pb-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSending}
          className="px-4 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
          style={{
            minHeight: 44,
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          {sentTo === null ? "Cancel" : "Done"}
        </button>
        {sentTo === null && (
          <button
            type="button"
            onClick={sendEmail}
            disabled={isSending || recipientsRaw.trim().length === 0}
            className="px-4 rounded-xl text-sm font-semibold disabled:opacity-40 transition"
            style={{
              minHeight: 44,
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              boxShadow:
                recipientsRaw.trim().length > 0
                  ? "0 0 16px rgba(var(--spark-accent-rgb),0.35)"
                  : "none",
            }}
          >
            {isSending ? "Sending…" : "Send summary"}
          </button>
        )}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <SparkSheet
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        eyebrow="SEND SUMMARY"
        title={tenantName}
      >
        {body}
      </SparkSheet>
    );
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
      style={{
        background: "rgba(var(--spark-bg-rgb),0.7)",
        backdropFilter: "saturate(180%) blur(12px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md spark-card overflow-hidden"
        style={{ borderRadius: 20 }}
        role="dialog"
        aria-modal="true"
        aria-label="Send weekly summary"
      >
        <div
          className="p-5"
          style={{ borderBottom: "1px solid rgba(var(--spark-ink-rgb),0.08)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            SEND SUMMARY
          </p>
          <h2 className="display text-xl font-bold truncate">{tenantName}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
            {periodLabel}
          </p>
        </div>
        <div className="p-5">{body}</div>
      </div>
    </div>
  );
}
