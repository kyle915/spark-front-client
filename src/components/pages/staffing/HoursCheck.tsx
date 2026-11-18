import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import StatusChip from "@/shared/StatusChip";
import { MarkHoursFlagReviewedMutation } from "@/api/mutations/HoursCheckMutations";
import type { HoursCheckMutationsMarkReviewedMutation as MarkType } from "@api/mutations/__generated__/HoursCheckMutationsMarkReviewedMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import type { HoursFlag, HoursShift, HoursReport } from "./hoursCheckData";

/**
 * Hours check before payroll — the staff-facing half. The rules run on the
 * server; this only shows what they found, beside the approve buttons, and
 * lets a person mark a flag "OK — reviewed" so it stops asking. Nothing here
 * blocks an approval: staff decide.
 */

const SEVERITY_LABEL: Record<string, string> = {
  high: "Look first",
  medium: "Worth a look",
  low: "FYI",
};

const severityColor = (s: string) =>
  s === "high"
    ? "var(--spark-orange)"
    : s === "medium"
      ? "var(--spark-gold)"
      : "var(--spark-text-meta)";

const fmtWhen = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

/** "2 to look at" chip for a BA row (or "Checked" once every flag is reviewed). */
export const BaFlagChip: React.FC<{ shifts: readonly HoursShift[] | undefined }> = ({ shifts }) => {
  if (!shifts || shifts.length === 0) return null;
  const open = shifts.filter((s) => s.needsLook).length;
  if (open === 0) {
    return (
      <StatusChip tone="neutral" small title="Every hours-check flag for this BA was reviewed">
        Checked
      </StatusChip>
    );
  }
  return (
    <StatusChip
      tone="attention"
      small
      title="Shifts the hours check wants a person to look at. Open the row to see why."
    >
      {open} to look at
    </StatusChip>
  );
};

/** Summary strip: "7 of 212 shifts need a look", per-rule counts, filter. */
export const HoursCheckSummary: React.FC<{
  report: HoursReport;
  lookOnly: boolean;
  onToggleLookOnly: () => void;
  explain: boolean;
  onExplain: () => void;
}> = ({ report, lookOnly, onToggleLookOnly, explain, onExplain }) => {
  const open = report.byRule.filter((r) => r.unreviewed > 0);
  return (
    <div
      className="rounded-xl px-4 py-3 mb-4"
      style={{ border: "1px solid var(--spark-border)", background: "rgba(var(--spark-ink-rgb),0.02)" }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold">
          Hours check:{" "}
          {report.needsLookShifts > 0 ? (
            <span style={{ color: "var(--spark-orange)" }}>
              {report.needsLookShifts} of {report.totalShifts} shift{report.totalShifts === 1 ? "" : "s"} need
              {report.needsLookShifts === 1 ? "s" : ""} a look
            </span>
          ) : (
            <span>
              nothing to look at in {report.totalShifts} shift{report.totalShifts === 1 ? "" : "s"}
            </span>
          )}
        </p>
        {report.flaggedShifts > report.needsLookShifts ? (
          <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            {report.flaggedShifts - report.needsLookShifts} already reviewed
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {report.needsLookShifts > 0 ? (
            <button
              type="button"
              onClick={onExplain}
              disabled={explain}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ border: "1px solid var(--spark-border)", color: "var(--spark-text)", background: "transparent" }}
              title="Adds one plain-English sentence to each flag. The checks themselves don't change."
            >
              {explain ? "Plain-English reasons on" : "Explain in plain English"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleLookOnly}
            aria-pressed={lookOnly}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{
              border: "1px solid var(--spark-border)",
              color: lookOnly ? "var(--spark-on-accent)" : "var(--spark-text)",
              background: lookOnly ? "var(--spark-lime)" : "transparent",
            }}
          >
            Needs a look{lookOnly ? " ✓" : ""}
          </button>
        </div>
      </div>
      {open.length > 0 ? (
        <p className="text-xs mt-2" style={{ color: "var(--spark-text-meta)" }}>
          {open.map((r) => `${r.title} (${r.unreviewed})`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
};

/** Chip in the shift row's Check column. */
export const ShiftFlagChip: React.FC<{
  shift: HoursShift | undefined;
  open: boolean;
  onToggle: () => void;
}> = ({ shift, open, onToggle }) => {
  if (!shift) return <span style={{ color: "var(--spark-text-meta)" }}>OK</span>;
  const pending = shift.flags.filter((f) => !f.reviewed);
  const worst = pending[0]?.severity ?? "low";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="text-xs whitespace-nowrap underline-offset-2 hover:underline"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: pending.length ? severityColor(worst) : "var(--spark-text-meta)",
        fontWeight: pending.length ? 600 : 400,
      }}
    >
      {pending.length ? `${pending.length} to look at` : "Reviewed"} {open ? "▾" : "▸"}
    </button>
  );
};

const FlagCard: React.FC<{
  flag: HoursFlag;
  shift: HoursShift;
  tenantId: string;
  onChanged: () => void;
}> = ({ flag, shift, tenantId, onChanged }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commit, busy] = useMutation<MarkType>(MarkHoursFlagReviewedMutation);
  const [note, setNote] = useState("");
  const [showFacts, setShowFacts] = useState(!flag.reviewed);

  const send = (undo: boolean) =>
    commit({
      variables: {
        input: {
          tenantId,
          eventUuid: shift.eventUuid,
          ambassadorUuid: shift.ambassadorUuid,
          code: flag.code,
          note: undo ? null : note || null,
          undo,
        },
      },
      onCompleted: (resp) => {
        const r = resp.markHoursFlagReviewed;
        showAlert(r?.message || "Done.", r?.success ? "success" : "error");
        if (r?.success) onChanged();
      },
      onError: (e) => showAlert(e.message, "error"),
    });

  return (
    <li
      className="rounded-lg px-3 py-2"
      style={{
        border: "1px solid var(--spark-border)",
        borderLeft: `3px solid ${flag.reviewed ? "var(--spark-border)" : severityColor(flag.severity)}`,
        opacity: flag.reviewed ? 0.75 : 1,
      }}
    >
      <div className="flex items-start gap-2 flex-wrap">
        <p className="text-sm font-semibold">{flag.title}</p>
        <span className="text-xs" style={{ color: severityColor(flag.severity) }}>
          {SEVERITY_LABEL[flag.severity] ?? flag.severity}
        </span>
        {flag.reviewed ? (
          <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            OK, reviewed by {flag.reviewedBy || "staff"} {fmtWhen(flag.reviewedAt)}
            {flag.reviewNote ? ` — “${flag.reviewNote}”` : ""}
          </span>
        ) : flag.staleReview ? (
          <span className="text-xs" style={{ color: "var(--spark-orange)" }}>
            Reviewed before, but the punches changed since
          </span>
        ) : null}
      </div>
      <p className="text-sm mt-1">{flag.summary}</p>
      {flag.aiReason ? (
        <p className="text-xs mt-1" style={{ color: "var(--spark-text-secondary)" }}>
          In plain English: {flag.aiReason}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setShowFacts((v) => !v)}
        className="text-xs mt-1"
        style={{ background: "transparent", border: "none", padding: 0, color: "var(--spark-text-meta)", cursor: "pointer" }}
      >
        {showFacts ? "Hide the facts ▾" : "Show the facts ▸"}
      </button>
      {showFacts ? (
        <>
          <dl className="grid gap-x-4 gap-y-0.5 mt-1 text-xs" style={{ gridTemplateColumns: "max-content 1fr" }}>
            {flag.facts.map((f) => (
              <div key={f.label} className="contents">
                <dt style={{ color: "var(--spark-text-meta)" }}>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs mt-1.5">
            <span style={{ color: "var(--spark-text-meta)" }}>Suggested: </span>
            {flag.action}
          </p>
        </>
      ) : null}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {flag.reviewed ? (
          <button
            type="button"
            onClick={() => send(true)}
            disabled={busy}
            className="text-xs disabled:opacity-50"
            style={{ background: "transparent", border: "none", padding: 0, color: "var(--spark-text-meta)", cursor: "pointer" }}
          >
            Undo review
          </button>
        ) : (
          <>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why it's OK (optional)"
              className="text-xs flex-1 min-w-[200px]"
              style={{
                background: "var(--spark-bg, #0d0f10)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                borderRadius: 8,
                padding: "6px 8px",
              }}
            />
            <button
              type="button"
              onClick={() => send(false)}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: "transparent", color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
            >
              OK — reviewed
            </button>
          </>
        )}
      </div>
    </li>
  );
};

/** Every flag on one shift, under its timesheet row. */
export const ShiftFlagList: React.FC<{
  shift: HoursShift;
  tenantId: string;
  onChanged: () => void;
}> = ({ shift, tenantId, onChanged }) => (
  <ul className="flex flex-col gap-2 py-2">
    {shift.flags.map((f) => (
      <FlagCard key={f.code} flag={f} shift={shift} tenantId={tenantId} onChanged={onChanged} />
    ))}
  </ul>
);
