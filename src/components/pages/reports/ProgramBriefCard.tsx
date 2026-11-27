import { useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { ProgramBriefQuery } from "@/api/queries/ProgramBriefQuery";
import type { ProgramBriefQuery as ProgramBriefQueryType } from "@api/queries/__generated__/ProgramBriefQuery.graphql";
import {
  GenerateProgramBriefMutation,
  SaveProgramBriefMutation,
  SetProgramBriefReviewedMutation,
} from "@/api/mutations/ProgramBriefMutations";
import type { ProgramBriefMutationsGenerateMutation } from "@api/mutations/__generated__/ProgramBriefMutationsGenerateMutation.graphql";
import type { ProgramBriefMutationsSaveMutation } from "@api/mutations/__generated__/ProgramBriefMutationsSaveMutation.graphql";
import type { ProgramBriefMutationsReviewedMutation } from "@api/mutations/__generated__/ProgramBriefMutationsReviewedMutation.graphql";
import { briefFooter, bulletsToText, textToBullets } from "@/lib/programBrief";
import SparkConfirm from "@/shared/SparkConfirm";

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;

type RangePreset = "30" | "90" | "180" | "ytd" | "custom";
type Brief = NonNullable<
  NonNullable<ProgramBriefQueryType["response"]["programBrief"]>["brief"]
>;

const TITLE = "Program brief";

/**
 * The short "what worked" note at the top of the program report.
 *
 * The page only reads a stored brief. Staff write it, edit it, and mark a
 * long or custom range reviewed. A brand user never sees a draft, and never
 * sees a brief whose approved-recap count has changed.
 */
const ProgramBriefCard: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  preset: RangePreset;
  staff: boolean;
  /** False while a custom range is missing a date and the page is showing a fallback. */
  canWrite?: boolean;
}> = ({ tenantId, startDate, endDate, preset, staff, canWrite = true }) => {
  const data = useLazyLoadQuery<ProgramBriefQueryType>(
    ProgramBriefQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const view = data.programBrief;
  const [local, setLocal] = useState<Brief | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [paragraph, setParagraph] = useState("");
  const [bullets, setBullets] = useState("");
  const [quote, setQuote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmRewrite, setConfirmRewrite] = useState(false);

  const windowKey = `${tenantId}|${startDate}|${endDate}|${preset}`;
  useEffect(() => {
    setLocal(undefined);
    setEditing(false);
    setProblem(null);
  }, [windowKey]);

  const [generate, writing] = useMutation<ProgramBriefMutationsGenerateMutation>(
    GenerateProgramBriefMutation,
  );
  const [save, saving] = useMutation<ProgramBriefMutationsSaveMutation>(SaveProgramBriefMutation);
  const [review, reviewing] = useMutation<ProgramBriefMutationsReviewedMutation>(
    SetProgramBriefReviewedMutation,
  );
  const busy = writing || saving || reviewing;

  if (!view) return null;
  const brief = local === undefined ? view.brief : local;
  const showBrief =
    !!brief && (staff || (brief.status === "reviewed" && !brief.isDraft && !brief.stale));

  const take = (
    result:
      | {
          ok: boolean;
          reason?: string | null;
          brief?: Brief | null;
        }
      | null
      | undefined,
    fallback: string,
  ) => {
    if (!result?.ok || !result.brief) {
      setProblem(result?.reason || fallback);
      return;
    }
    setProblem(null);
    setLocal(result.brief);
    setEditing(false);
  };

  const runWrite = () => {
    setConfirmRewrite(false);
    setProblem(null);
    generate({
      variables: { tenantId, startDate, endDate, preset },
      onCompleted: (res) => take(res.generateProgramBrief, "The brief could not be written."),
      onError: () => setProblem("The brief could not be written."),
    });
  };

  const write = () => {
    if (busy || !canWrite) return;
    if (brief) {
      setConfirmRewrite(true);
      return;
    }
    runWrite();
  };

  const saveEdits = () => {
    if (busy || !brief) return;
    save({
      variables: {
        id: brief.id,
        paragraph: paragraph.trim(),
        bullets: textToBullets(bullets),
        quote: quote.trim(),
      },
      onCompleted: (res) => take(res.saveProgramBrief, "The edit could not be saved."),
      onError: () => setProblem("The edit could not be saved."),
    });
  };

  const setReviewed = (next: boolean) => {
    if (busy || !brief) return;
    review({
      variables: { id: brief.id, reviewed: next },
      onCompleted: (res) =>
        take(res.setProgramBriefReviewed, "The review could not be saved."),
      onError: () => setProblem("The review could not be saved."),
    });
  };

  if (!showBrief) {
    if (!view.enough) {
      return (
        <section className="spark-card p-5 sm:p-6" aria-label={TITLE}>
          <h2 className="display text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>
            {TITLE}
          </h2>
          <p className="text-sm mt-2" style={META}>
            Not enough approved recaps in these dates to write a brief.
          </p>
        </section>
      );
    }
    if (!staff) return null;
    return (
      <section className="spark-card p-5 sm:p-6" aria-label={TITLE}>
        <h2 className="display text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>
          {TITLE}
        </h2>
        <p className="text-sm mt-2" style={META}>
          No brief for these dates yet.
        </p>
        <p className="text-xs mt-1" style={META}>
          {canWrite
            ? "A 30- or 90-day range is shown to the brand once every number checks out. A longer or custom range stays a draft until you mark it reviewed."
            : "Pick both dates before writing a brief. Until then this page is showing the last 90 days."}
        </p>
        {canWrite ? (
          <button
            type="button"
            className="spark-btn-ghost mt-3 print:hidden"
            onClick={write}
            disabled={busy}
          >
            {writing ? "Writing" : "Write brief"}
          </button>
        ) : null}
        {problem ? (
          <p className="text-sm mt-2" role="status" style={{ color: "var(--spark-orange)" }}>
            {problem}
          </p>
        ) : null}
      </section>
    );
  }

  if (!brief) return null;

  const savedBody = (className: string) => (
    <div className={className}>
      <p className="text-sm leading-relaxed m-0" style={TEXT}>
        {brief.paragraph}
      </p>
      {brief.bullets.length > 0 ? (
        <ul className="m-0 pl-5 list-disc flex flex-col gap-1">
          {brief.bullets.map((line, index) => (
            <li key={`${index}-${line}`} className="text-sm" style={TEXT}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {brief.quote ? (
        <blockquote className="m-0 text-sm" style={SECONDARY}>
          “{brief.quote}”
        </blockquote>
      ) : null}
    </div>
  );

  return (
    <section className="spark-card p-5 sm:p-6" aria-label={TITLE} id="program-brief">
      <h2 className="display text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>
        {TITLE}
      </h2>
      {editing ? (
        <div className="mt-3 flex flex-col gap-2 max-w-3xl print:hidden">
          <textarea
            value={paragraph}
            onChange={(event) => setParagraph(event.target.value)}
            rows={4}
            aria-label="Brief paragraph"
            className="spark-input w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed"
          />
          <textarea
            value={bullets}
            onChange={(event) => setBullets(event.target.value)}
            rows={3}
            aria-label="Brief bullets, one per line"
            placeholder="One bullet per line"
            className="spark-input w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed"
          />
          <input
            value={quote}
            onChange={(event) => setQuote(event.target.value)}
            aria-label="Brief quote"
            placeholder="A comment from these recaps, copied in full, or leave blank"
            className="spark-input w-full rounded-xl px-3 py-2.5 text-sm"
          />
        </div>
      ) : null}
      {savedBody(
        editing
          ? "mt-3 max-w-3xl hidden print:block"
          : "mt-3 max-w-3xl flex flex-col gap-3",
      )}
      <p className="text-xs mt-3" style={META}>
        {briefFooter(brief)}
      </p>
      {staff ? (
        <div className="flex flex-wrap items-center gap-2 mt-3 print:hidden">
          {editing ? (
            <>
              <button type="button" className="spark-btn-ghost" onClick={saveEdits} disabled={busy}>
                {saving ? "Saving" : "Save edits"}
              </button>
              <button
                type="button"
                className="spark-btn-ghost"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={() => {
                setParagraph(brief.paragraph);
                setBullets(bulletsToText(brief.bullets));
                setQuote(brief.quote ?? "");
                setEditing(true);
              }}
              disabled={busy}
            >
              Edit
            </button>
          )}
          {!brief.stale && !editing ? (
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={() => setReviewed(brief.status !== "reviewed")}
              disabled={busy}
            >
              {brief.status === "reviewed" ? "Back to draft" : "Mark reviewed"}
            </button>
          ) : null}
          {canWrite ? (
            <button type="button" className="spark-btn-ghost" onClick={write} disabled={busy}>
              {writing ? "Writing" : "Write again"}
            </button>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p className="text-sm mt-2" role="status" style={{ color: "var(--spark-orange)" }}>
          {problem}
        </p>
      ) : null}
      {confirmRewrite ? (
        <SparkConfirm
          tone="danger"
          kicker="Program brief"
          title="Write this brief again?"
          body="The current brief, including any manual edits, will be replaced."
          confirmLabel="Write again"
          busy={writing}
          onConfirm={runWrite}
          onCancel={() => setConfirmRewrite(false)}
        />
      ) : null}
    </section>
  );
};

export default ProgramBriefCard;
