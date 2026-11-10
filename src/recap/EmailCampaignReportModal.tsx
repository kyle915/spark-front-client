import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import { EmailCampaignReportMutation } from "@/api/mutations/EmailCampaignReportMutation";
import type { EmailCampaignReportMutation as EmailCampaignReportMutationType } from "@api/mutations/__generated__/EmailCampaignReportMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Compose-style modal for the "✉ Email Report" button in the Recaps
 * sticky action bar.
 *
 * Fields:
 *   - Recipients (comma- or newline-separated, the input splits on
 *     both so kyle can paste a list from Gmail without reformatting)
 *   - Optional title / subtitle (overrides the cover-page defaults)
 *   - Optional cover-letter message
 *
 * Submitting calls `emailCampaignReport`. Same backend recap-id list
 * as the download path, so the multi-select state survives the
 * compose modal — if kyle cancels, the selection stays for retry.
 */

type Props = {
  recapIds: string[];
  onClose: () => void;
  onSent: () => void;
};

// Splits a free-form recipient blob into clean email strings.
// Accepts commas, semicolons, newlines, tabs, and arbitrary whitespace
// so kyle can paste from anywhere (Gmail "To:" field, a spreadsheet
// column, etc.) without rewrapping the input.
const splitRecipients = (raw: string): string[] => {
  return raw
    .split(/[,;\n\r\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function EmailCampaignReportModal({
  recapIds,
  onClose,
  onSent,
}: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [recipientsText, setRecipientsText] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [message, setMessage] = useState("");
  const [commitEmail, isSending] =
    useMutation<EmailCampaignReportMutationType>(EmailCampaignReportMutation);

  const recipients = splitRecipients(recipientsText);
  const invalid = recipients.filter((r) => !EMAIL_RE.test(r));
  const ready = recipients.length > 0 && invalid.length === 0;

  const send = () => {
    if (!ready || isSending) return;
    commitEmail({
      variables: {
        input: {
          recapIds,
          recipients,
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          message: message.trim() || null,
        },
      },
      onCompleted: (res) => {
        const r = res.emailCampaignReport;
        if (r?.success) {
          showAlert(r.message || "Report sent.", "success");
          onSent();
          onClose();
        } else {
          showAlert(r?.message ?? "Email send failed.", "error");
        }
      },
      onError: (err) => showAlert(err.message, "error"),
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
        className="w-full max-w-lg spark-card overflow-hidden"
        style={{
          borderRadius: 20,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="p-5" style={{ borderBottom: "1px solid var(--spark-border)" }}>
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            EMAIL CAMPAIGN REPORT
          </p>
          <h2 className="display text-xl font-bold">
            Send the {recapIds.length}-recap PDF to a client
          </h2>
        </div>

        <div className="overflow-y-auto" style={{ flex: 1 }}>
          <div className="p-5 space-y-4">
            <div>
              <label
                className="mono text-[10px] block mb-1.5"
                style={{
                  letterSpacing: "0.16em",
                  color: "var(--spark-text-meta)",
                }}
              >
                RECIPIENTS *
              </label>
              <textarea
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder="client@brand.com, ops@brand.com (or paste a Gmail list)"
                rows={2}
                autoFocus
                className="w-full rounded-xl text-sm"
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              <div
                className="mono text-[10px] mt-1 flex items-center gap-2"
                style={{
                  letterSpacing: "0.14em",
                  color:
                    invalid.length > 0
                      ? "var(--spark-orange)"
                      : "rgba(255,255,255,0.40)",
                }}
              >
                {recipients.length > 0 ? (
                  invalid.length > 0 ? (
                    <span>
                      {invalid.length} INVALID · {recipients.length - invalid.length}{" "}
                      OK
                    </span>
                  ) : (
                    <span>
                      {recipients.length} OK
                    </span>
                  )
                ) : (
                  <span>COMMA OR NEWLINE SEPARATED</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mono text-[10px] block mb-1.5"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  TITLE (OPTIONAL)
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="May Liquid Death Sampling"
                  className="w-full rounded-xl text-sm"
                  style={{
                    padding: "0.55rem 0.85rem",
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label
                  className="mono text-[10px] block mb-1.5"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  SUBTITLE (OPTIONAL)
                </label>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Campaign Report"
                  className="w-full rounded-xl text-sm"
                  style={{
                    padding: "0.55rem 0.85rem",
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                className="mono text-[10px] block mb-1.5"
                style={{
                  letterSpacing: "0.16em",
                  color: "var(--spark-text-meta)",
                }}
              >
                COVER MESSAGE (OPTIONAL)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey team, attached is the May Liquid Death rollup. Highlights inside…"
                rows={4}
                className="w-full rounded-xl text-sm"
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="p-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            {recapIds.length} RECAP{recapIds.length === 1 ? "" : "S"} ATTACHED
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!ready || isSending}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow:
                  ready && !isSending
                    ? "0 0 16px rgba(242,243,238,0.4)"
                    : "none",
              }}
            >
              {isSending ? "Sending…" : "Send Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
