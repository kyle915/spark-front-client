import { useId, useState } from "react";
import {
  draftChecks,
  formatDraftDate,
  formatDraftTime,
  queueLabel,
  withTyped,
  type DraftFormValues,
  type PasteQueue,
  type PastedDraft,
} from "./pasteDetails";
import { parseRequestDetails } from "./pasteDetailsApi";

/**
 * "Paste details" on Create Request — staff only.
 *
 * Staff paste an email body or rows copied from a sheet. The server reads
 * the visits it can find and this panel hands them to the form one at a
 * time. The form is only pre-filled: the person checks it and submits it
 * through the same Create Request button and checks as a typed request.
 *
 * The pasted text lives in this component's state only. It is not written
 * to the form's saved draft or anywhere else, and it is gone on reload.
 */

/** Where the time zone for the loaded draft stands. */
export type ZoneState =
  | { kind: "none" }
  | { kind: "looking" }
  | { kind: "set"; name: string }
  | { kind: "unset" };

const meta = { color: "var(--spark-text-meta)" } as const;
const secondary = { color: "var(--spark-text-secondary)" } as const;
const flag = { color: "var(--spark-flag-ink, var(--spark-orange))" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs pt-0.5" style={meta}>
        {label}
      </dt>
      <dd className="text-sm min-w-0 break-words">{children}</dd>
    </>
  );
}

const blank = (
  <span style={meta}>Not in the text</span>
);

function DraftSummary({
  draft,
  values,
  zone,
}: {
  draft: PastedDraft;
  values: DraftFormValues;
  zone: ZoneState;
}) {
  const date = formatDraftDate(draft.date);
  const start = withTyped(formatDraftTime(draft.startTime), draft.startAsTyped);
  const end = withTyped(formatDraftTime(draft.endTime), draft.endAsTyped);
  const checks = draftChecks(draft, values);
  const productNames = draft.products.map((p) => p.name);

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        <Row label="Date">{withTyped(date, draft.dateAsTyped) || blank}</Row>
        <Row label="Start">{start || blank}</Row>
        <Row label="End">{end || blank}</Row>
        <Row label="Store">
          {values.venue ? withTyped(values.venue, draft.storeName) : blank}
        </Row>
        <Row label="Address">{draft.address || blank}</Row>
        <Row label="Products">
          {productNames.length > 0 ? productNames.join(", ") : blank}
        </Row>
        <Row label="Notes">{draft.notes || blank}</Row>
        <Row label="Time zone">
          {zone.kind === "set" ? (
            `${zone.name}, from the address. Check it.`
          ) : zone.kind === "looking" ? (
            <span style={meta}>Looking up the address…</span>
          ) : (
            <span style={flag}>
              Not set. Pick the address suggestion in the form, or choose the time zone.
            </span>
          )}
        </Row>
      </dl>

      {draft.couldNotRead.length > 0 && (
        <div>
          <p className="text-xs mb-1.5" style={meta}>
            Could not read. These are blank in the form.
          </p>
          {/* Same pills as the Staffing Board's search filters. */}
          <ul className="flex flex-wrap gap-2" aria-label="Could not read">
            {draft.couldNotRead.map((label) => (
              <li
                key={label}
                className="inline-flex items-center rounded-full text-[13px] px-3 py-1"
                style={{ border: "1px solid var(--spark-border)", ...flag }}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {checks.length > 0 && (
        <div>
          <p className="text-xs mb-1" style={meta}>
            Check these
          </p>
          <ul className="space-y-1 text-sm list-disc pl-5" style={secondary}>
            {checks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PasteDetailsPanel({
  tenantId,
  queue,
  currentValues,
  zone,
  onDrafts,
  onSkip,
  onClear,
}: {
  tenantId: string;
  /** The drafts read from the last paste, and which one is in the form. */
  queue: PasteQueue | null;
  /** Form values of the draft in the form (null when there is none). */
  currentValues: DraftFormValues | null;
  zone: ZoneState;
  /** New drafts were read: load the first one into the form. */
  onDrafts: (drafts: PastedDraft[]) => void;
  /** Leave this draft out and load the next one. */
  onSkip: () => void;
  /** Drop the remaining drafts. The form is left as it is. */
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const [cut, setCut] = useState(false);
  const textId = useId();

  const read = async () => {
    const pasted = text.trim();
    if (!pasted || reading) return;
    setReading(true);
    setMessage("");
    setCut(false);
    try {
      const result = await parseRequestDetails(tenantId, pasted);
      if (!result.ok || result.drafts.length === 0) {
        setMessage(
          result.message || "No visit could be read from that text. Fill in the form by hand.",
        );
      } else {
        setCut(result.truncated);
        onDrafts(result.drafts);
        // Read once, then let go of it.
        setText("");
      }
    } catch {
      setMessage("Pasted details could not be read right now. Fill in the form by hand.");
    } finally {
      setReading(false);
    }
  };

  const current = queue ? queue.drafts[queue.index] : null;
  const remaining = queue ? queue.drafts.length - queue.index - 1 : 0;

  return (
    <section className="spark-card p-5 spark-scale" aria-label="Paste details">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm">Paste details</h2>
          <p className="text-sm mt-0.5" style={meta}>
            Paste an email or rows copied from a sheet to fill in the form. You check it and
            submit as usual. Nothing is saved until you do.
          </p>
        </div>
        {!open && !queue && (
          <button type="button" className="spark-btn-ghost" onClick={() => setOpen(true)}>
            Paste text
          </button>
        )}
      </div>

      {(open || queue) && (
        <div className="mt-4 space-y-3">
          {!queue && (
            <>
              <label htmlFor={textId} className="sr-only">
                Email text or sheet rows
              </label>
              <textarea
                id={textId}
                className="spark-input w-full rounded-lg px-3 py-2 text-sm"
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the email, or one or more rows from the sheet"
                disabled={reading}
                // Pasted client text should not be offered back by the browser.
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="spark-btn-ghost"
                  onClick={read}
                  disabled={reading || !text.trim()}
                >
                  {reading ? "Reading…" : "Read details"}
                </button>
                <button
                  type="button"
                  className="text-sm underline px-1"
                  style={meta}
                  onClick={() => {
                    setText("");
                    setMessage("");
                    setOpen(false);
                  }}
                  disabled={reading}
                >
                  Cancel
                </button>
                <p className="text-xs" style={meta}>
                  Phone numbers, email addresses and signatures are removed before the text is
                  read. The text is not kept.
                </p>
              </div>
            </>
          )}

          {message && (
            <p role="status" className="text-sm" style={flag}>
              {message}
            </p>
          )}

          {queue && current && currentValues && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="font-semibold text-sm">{queueLabel(queue)}</p>
                <p className="text-sm" style={meta}>
                  {remaining > 0
                    ? `Loaded into the form below. ${remaining} more after this one.`
                    : "Loaded into the form below."}
                </p>
                <span className="flex-1" />
                {remaining > 0 && (
                  <button type="button" className="spark-btn-ghost !px-3 !py-1.5" onClick={onSkip}>
                    Skip this one
                  </button>
                )}
                <button
                  type="button"
                  className="text-sm underline px-1"
                  style={meta}
                  onClick={() => {
                    setOpen(false);
                    setCut(false);
                    onClear();
                  }}
                >
                  {remaining > 0 ? "Stop and clear the rest" : "Done"}
                </button>
              </div>
              {cut && (
                <p className="text-sm" style={flag}>
                  The text held more than could be read in one go. Paste the rest afterwards.
                </p>
              )}
              <DraftSummary draft={current} values={currentValues} zone={zone} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
