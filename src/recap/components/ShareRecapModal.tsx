import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import { ShareRecapByEmailMutation } from "@/api/mutations/ShareRecapByEmailMutation";
import type { ShareRecapByEmailMutation as ShareRecapByEmailMutationType } from "@/api/mutations/__generated__/ShareRecapByEmailMutation.graphql";
import { recapShareUrl } from "@/utils/recapShare";
import { EMAIL_RE, parseRecipients } from "@/utils/emailRecipients";
import { useAlertStore } from "@/store/alertStore";

/**
 * On-platform Share dialog for recap views — replaces the native OS
 * share sheet (navigator.share dumped users into Mail/AirDrop with no
 * Spark chrome). Two paths, same public /r/:token link:
 *   1. Copy link — clipboard, for pasting anywhere.
 *   2. Email it — recipient(s) + optional note, sent by the API
 *      (shareRecapByEmail) from Spark's sender with the client-host link.
 */

type Props = {
  /** Relay global id of the recap (legacy Recap or CustomRecap). */
  recapId: string;
  kind: "legacy" | "custom";
  shareToken: string;
  recapName?: string | null;
  onClose: () => void;
};

export default function ShareRecapModal({
  recapId,
  kind,
  shareToken,
  recapName,
  onClose,
}: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const shareUrl = recapShareUrl(shareToken);

  const [copied, setCopied] = useState(false);
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [note, setNote] = useState("");
  const [sentTo, setSentTo] = useState<number | null>(null);

  const [commitShare, isSending] =
    useMutation<ShareRecapByEmailMutationType>(ShareRecapByEmailMutation);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showAlert("Link copied.", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert("Couldn't copy — select the link and copy it.", "warning");
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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
      style={{
        background: "rgba(10,11,13,0.7)",
        backdropFilter: "blur(8px)",
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
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            SHARE RECAP
          </p>
          <h2 className="display text-xl font-bold truncate">
            {recapName || "Activation recap"}
          </h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Public link + copy */}
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
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                  color: "rgba(255,255,255,0.75)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={copyLink}
                className="px-3 py-2 rounded-xl text-sm font-semibold shrink-0 transition"
                style={{
                  background: copied
                    ? "rgba(197,245,70,0.15)"
                    : "transparent",
                  color: copied ? "var(--spark-lime)" : "var(--spark-text)",
                  border: `1px solid ${
                    copied ? "rgba(197,245,70,0.4)" : "var(--spark-border)"
                  }`,
                }}
              >
                {copied ? "✓ Copied" : "Copy link"}
              </button>
            </div>
            <p
              className="text-[11px] mt-2"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Anyone with the link can view the recap — no login needed.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--spark-border)" }} />

          {/* Email it */}
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
                  autoFocus
                  className="w-full rounded-xl text-sm"
                  style={{
                    padding: "0.6rem 0.85rem",
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
                  background: "rgba(197,245,70,0.08)",
                  border: "1px solid rgba(197,245,70,0.3)",
                  color: "var(--spark-lime)",
                }}
              >
                ✓ Sent to {sentTo} recipient{sentTo === 1 ? "" : "s"} — the
                email links to this recap on client.igniteproductions.co.
              </div>
            )}
          </div>
        </div>

        <div
          className="p-4 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
            style={{
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
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow:
                  recipientsRaw.trim().length > 0
                    ? "0 0 16px rgba(197,245,70,0.35)"
                    : "none",
              }}
            >
              {isSending ? "Sending…" : "Send email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
