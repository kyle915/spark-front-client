import { useMemo, useState } from "react";
import { useMutation } from "react-relay/hooks";
import { ShareRecapsByEmailMutation } from "@/api/mutations/ShareRecapsByEmailMutation";
import type { ShareRecapsByEmailMutation as ShareRecapsByEmailMutationType } from "@/api/mutations/__generated__/ShareRecapsByEmailMutation.graphql";
import { recapShareUrl } from "@/utils/recapShare";
import { EMAIL_RE, parseRecipients } from "@/utils/emailRecipients";
import { useAlertStore } from "@/store/alertStore";

/**
 * Bulk sibling of ShareRecapModal — the Recaps list multi-select
 * Share / Email action. Same two paths as the single-share dialog,
 * fanned out over N recaps:
 *   1. Copy links — every selected recap's public /r/:token URL,
 *      newline-separated, for pasting anywhere.
 *   2. Email them — recipient(s) + optional note; the API sends ONE
 *      digest email per recipient listing every recap with its link
 *      (shareRecapsByEmail), which reads far better for clients than
 *      N near-identical emails landing at once.
 */

// Mirrors the server-side cap in ShareRecapsByEmailInput handling —
// keeps the button disabled with a friendly note instead of letting
// the resolver reject the send.
export const BULK_SHARE_MAX = 25;

export type BulkShareRecap = {
  /** Relay global id (legacy Recap or CustomRecap — see `kind`). */
  id: string;
  kind: "legacy" | "custom";
  name: string;
  shareToken: string | null;
};

type Props = {
  recaps: BulkShareRecap[];
  onClose: () => void;
  /** Fired after a successful email send (parent clears selection +
      refreshes so the pipeline shows Shared). */
  onSent: () => void;
  /** Fired after links are copied — emailing IS sharing, and so is
      handing someone the links; the parent stamps Shared via
      markRecapsShared for the copied set. */
  onLinksCopied: () => void;
};

export default function ShareRecapsBulkModal({
  recaps,
  onClose,
  onSent,
  onLinksCopied,
}: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  // Rows without a minted token can't render a public link — the list
  // always resolves one today, so this is purely defensive.
  const shareable = useMemo(
    () => recaps.filter((r) => Boolean(r.shareToken)),
    [recaps],
  );
  const overCap = shareable.length > BULK_SHARE_MAX;

  const [copied, setCopied] = useState(false);
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [note, setNote] = useState("");
  const [sentTo, setSentTo] = useState<number | null>(null);

  const [commitShare, isSending] =
    useMutation<ShareRecapsByEmailMutationType>(ShareRecapsByEmailMutation);

  const copyLinks = async () => {
    const links = shareable.map((r) => recapShareUrl(r.shareToken!));
    if (links.length === 0) {
      showAlert("No share links on the selected recaps.", "warning");
      return;
    }
    try {
      await navigator.clipboard.writeText(links.join("\n"));
      setCopied(true);
      showAlert(
        `${links.length} link${links.length === 1 ? "" : "s"} copied.`,
        "success",
      );
      onLinksCopied();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert("Couldn't reach the clipboard.", "warning");
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
    if (recipients.length > 10) {
      showAlert("Share with up to 10 recipients at a time.", "warning");
      return;
    }
    if (shareable.length === 0 || overCap) return;
    commitShare({
      variables: {
        input: {
          recapIds: shareable
            .filter((r) => r.kind === "legacy")
            .map((r) => r.id),
          customRecapIds: shareable
            .filter((r) => r.kind === "custom")
            .map((r) => r.id),
          recipients,
          message: note.trim() || null,
        },
      },
      onCompleted: (resp) => {
        const r = resp.shareRecapsByEmail;
        if (r?.success) {
          const n = r.sentCount ?? recipients.length;
          setSentTo(n);
          showAlert(
            `${r.sharedCount ?? shareable.length} recap link${
              (r.sharedCount ?? shareable.length) === 1 ? "" : "s"
            } emailed to ${n} recipient${n === 1 ? "" : "s"}.`,
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
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[8vh]"
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
        aria-label="Share selected recaps"
      >
        <div
          className="p-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            SHARE RECAPS
          </p>
          <h2 className="display text-xl font-bold">
            {shareable.length} selected
          </h2>
          <div
            className="mt-3 space-y-1 overflow-y-auto"
            style={{ maxHeight: 140 }}
          >
            {shareable.map((r) => (
              <p
                key={r.id}
                className="text-xs truncate"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                <span
                  className="mono mr-2"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.12em",
                    color: "var(--spark-lime)",
                  }}
                >
                  ●
                </span>
                {r.name}
              </p>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Public links + copy */}
          <div>
            <p
              className="mono text-[10px] mb-2"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              PUBLIC LINKS
            </p>
            <button
              type="button"
              onClick={copyLinks}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: copied
                  ? "rgba(var(--spark-accent-rgb),0.15)"
                  : "transparent",
                color: copied ? "var(--spark-lime)" : "var(--spark-text)",
                border: `1px solid ${
                  copied ? "rgba(var(--spark-accent-rgb),0.4)" : "var(--spark-border)"
                }`,
              }}
            >
              {copied
                ? `✓ Copied ${shareable.length}`
                : `Copy ${shareable.length} link${
                    shareable.length === 1 ? "" : "s"
                  }`}
            </button>
            <p
              className="text-[11px] mt-2"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Anyone with a link can view that recap — no login needed.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--spark-border)" }} />

          {/* Email them */}
          <div>
            <p
              className="mono text-[10px] mb-2"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              EMAIL THEM
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
                <p
                  className="text-[11px]"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  Each recipient gets one email listing all{" "}
                  {shareable.length} recap
                  {shareable.length === 1 ? "" : "s"}.
                  {overCap ? (
                    <span style={{ color: "var(--spark-orange)" }}>
                      {" "}
                      Max {BULK_SHARE_MAX} per send — trim the selection.
                    </span>
                  ) : null}
                </p>
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
                ✓ Sent to {sentTo} recipient{sentTo === 1 ? "" : "s"} — one
                email lists all {shareable.length} recap
                {shareable.length === 1 ? "" : "s"} on
                client.igniteproductions.co.
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
            onClick={() => {
              onClose();
              if (sentTo !== null) onSent();
            }}
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
              disabled={
                isSending ||
                recipientsRaw.trim().length === 0 ||
                shareable.length === 0 ||
                overCap
              }
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                boxShadow:
                  recipientsRaw.trim().length > 0 && !overCap
                    ? "0 0 16px rgba(var(--spark-accent-rgb),0.35)"
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
