import { useEffect, useState, type ReactNode } from "react";
import { useMutation } from "react-relay/hooks";
import { ShareRecapByEmailMutation } from "@/api/mutations/ShareRecapByEmailMutation";
import type { ShareRecapByEmailMutation as ShareRecapByEmailMutationType } from "@/api/mutations/__generated__/ShareRecapByEmailMutation.graphql";
import { recapShareUrl } from "@/utils/recapShare";
import { EMAIL_RE, parseRecipients } from "@/utils/emailRecipients";
import { useAlertStore } from "@/store/alertStore";
import { SparkSheet } from "@/shared/SparkSheet";
import { CopyMorphButton } from "@/motion/CopyMorphButton";
import { PaperPlaneSendButton } from "@/motion/FeedbackActionButton";

/**
 * On-platform Share dialog for recap views — replaces the native OS
 * share sheet. Mobile uses a vaul bottom sheet; desktop stays centered.
 */

type Props = {
  recapId: string;
  kind: "legacy" | "custom";
  shareToken: string;
  recapName?: string | null;
  onClose: () => void;
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

export default function ShareRecapModal({
  recapId,
  kind,
  shareToken,
  recapName,
  onClose,
}: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const shareUrl = recapShareUrl(shareToken);
  const mobile = useIsMobileSheet();

  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [note, setNote] = useState("");
  const [sentTo, setSentTo] = useState<number | null>(null);

  const [commitShare, isSending] =
    useMutation<ShareRecapByEmailMutationType>(ShareRecapByEmailMutation);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showAlert("Link copied.", "success");
    } catch (err) {
      showAlert("Couldn't copy — select the link and copy it.", "warning");
      throw err;
    }
  };

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
    commitShare({
      variables: {
        input: {
          recapId: kind === "legacy" ? recapId : null,
          customRecapId: kind === "custom" ? recapId : null,
          recipients,
          message: note.trim() || null,
        },
      },
      onCompleted: (resp) => {
        const r = resp.shareRecapByEmail;
        if (r?.success) {
          const n = r.sentCount ?? recipients.length;
          setSentTo(n);
          showAlert(
            `Recap link emailed to ${n} recipient${n === 1 ? "" : "s"}.`,
            "success",
          );
        } else {
          showAlert(r?.message || "Couldn't send the email.", "error");
        }
      },
      onError: (err) => {
        showAlert(err.message || "Couldn't send the email.", "error");
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
          PUBLIC LINK
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 rounded-xl text-xs mono"
            style={{
              padding: "0.6rem 0.75rem",
              minHeight: 44,
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text-secondary)",
              outline: "none",
            }}
          />
          <CopyMorphButton
            onCopy={copyLink}
            label="Copy link"
            copiedLabel="Copied"
            title="Copy public recap link"
            className="px-3 rounded-xl text-sm font-semibold shrink-0"
            style={{
              minHeight: 44,
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
            iconSize={13}
          />
        </div>
        <p
          className="text-[11px] mt-2"
          style={{ color: "var(--spark-text-meta)" }}
        >
          Anyone with the link can view the recap — no login needed.
        </p>
      </div>

      <div style={{ borderTop: "1px solid rgba(var(--spark-ink-rgb),0.08)" }} />

      <div>
        <p
          className="mono text-[10px] mb-2"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          EMAIL IT
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
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
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
            ✓ Sent to {sentTo} recipient{sentTo === 1 ? "" : "s"} — the email
            links to this recap on client.igniteproductions.co.
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
          <PaperPlaneSendButton
            busy={isSending}
            label="Send email"
            busyLabel="Sending…"
            doneLabel="Sent"
            onClick={sendEmail}
            disabled={recipientsRaw.trim().length === 0}
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
          />
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
        eyebrow="SHARE RECAP"
        title={recapName || "Activation recap"}
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
        aria-label="Share recap"
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
            SHARE RECAP
          </p>
          <h2 className="display text-xl font-bold truncate">
            {recapName || "Activation recap"}
          </h2>
        </div>
        <div className="p-5">{body}</div>
      </div>
    </div>
  );
}
