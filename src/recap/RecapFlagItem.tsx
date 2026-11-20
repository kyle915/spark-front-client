import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "react-relay/hooks";
import { ResolveRecapFlagMutation } from "@/api/mutations/ResolveRecapFlagMutation";
import type { ResolveRecapFlagMutation as ResolveRecapFlagMutationType } from "@api/mutations/__generated__/ResolveRecapFlagMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { severityTone } from "./receiptChecks";

/**
 * One staff-only recap flag: kind + severity chip, the plain-language
 * explanation, a link to the other recap, and resolve / reopen. Shared by
 * the recap's Receipts panel and the Receipt checks page.
 */
export type RecapFlagItemData = {
  id: string;
  kindLabel: string;
  severity: string;
  explanation: string;
  otherRecapUuid?: string | null;
  recapUuid?: string;
  resolvedAt?: string | null;
  resolvedByName?: string | null;
  resolutionNote: string;
  autoCleared: boolean;
};

const meta = { color: "var(--spark-text-meta)" } as const;

export const RecapFlagItem: React.FC<{
  flag: RecapFlagItemData;
  /** Above the explanation, e.g. the brand and event on the list page. */
  context?: React.ReactNode;
}> = ({ flag, context }) => {
  const tone = severityTone(flag.severity);
  const showAlert = useAlertStore((s) => s.showAlert);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [commit, busy] = useMutation<ResolveRecapFlagMutationType>(ResolveRecapFlagMutation);
  const resolved = Boolean(flag.resolvedAt);

  const send = (reopen: boolean) => {
    if (busy) return;
    if (!reopen && !note.trim()) {
      showAlert("Add a short note saying what you found.", "warning");
      return;
    }
    commit({
      variables: { input: { flagId: flag.id, note: note.trim(), reopen } },
      onCompleted: (res) => {
        const r = res.resolveRecapFlag;
        if (!r.success) {
          showAlert(r.message, "error");
          return;
        }
        setOpen(false);
        setNote("");
        showAlert(r.message, "success");
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <li
      className="py-3"
      style={{ borderTop: "1px solid var(--spark-hairline)", opacity: resolved ? 0.75 : 1 }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[12px] px-2.5 py-0.5 rounded-full font-medium"
          style={{ color: tone.color, background: tone.background, border: `1px solid ${tone.border}` }}
        >
          {flag.kindLabel}
        </span>
        <span className="text-[12px]" style={meta}>
          {tone.label} severity
          {resolved ? (flag.autoCleared ? " · cleared automatically" : " · resolved") : ""}
        </span>
      </div>
      {context ? <div className="text-[13px] mt-1.5">{context}</div> : null}
      <p className="text-[14px] mt-1.5" style={{ color: "var(--spark-text)", maxWidth: "70ch" }}>
        {flag.explanation}
      </p>
      <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[13px]">
        {flag.otherRecapUuid ? (
          <Link to={`/recap/view-custom/${flag.otherRecapUuid}`} className="underline">
            Open the other recap
          </Link>
        ) : null}
        {resolved ? (
          <>
            {!flag.autoCleared && flag.resolutionNote ? (
              <span style={meta}>
                {flag.resolvedByName ? `${flag.resolvedByName}: ` : ""}
                {flag.resolutionNote}
              </span>
            ) : null}
            <button type="button" className="underline" disabled={busy} onClick={() => send(true)}>
              Reopen
            </button>
          </>
        ) : (
          <button type="button" className="underline" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Resolve"}
          </button>
        )}
      </div>
      {open && !resolved ? (
        <div className="mt-2 flex flex-col gap-2" style={{ maxWidth: "60ch" }}>
          <label className="text-[13px]" htmlFor={`flag-note-${flag.id}`} style={meta}>
            What did you find? (staff only)
          </label>
          <textarea
            id={`flag-note-${flag.id}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-[14px] rounded-lg px-3 py-2"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.04)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          />
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => send(false)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold"
              style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
            >
              {busy ? "Saving…" : "Resolve flag"}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
};

export default RecapFlagItem;
