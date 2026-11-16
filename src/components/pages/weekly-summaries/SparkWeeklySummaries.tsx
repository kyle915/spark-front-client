import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAlertStore } from "@/store/alertStore";
import { WeeklyClientSummariesQuery } from "@/api/queries/WeeklyClientSummariesQuery";
import type { WeeklyClientSummariesQuery as WeekQueryType } from "@api/queries/__generated__/WeeklyClientSummariesQuery.graphql";
import {
  GenerateWeeklyClientSummaryMutation,
  SaveWeeklyClientSummaryMutation,
  SetWeeklyClientSummaryReviewedMutation,
} from "@/api/mutations/WeeklyClientSummaryMutations";
import type { WeeklyClientSummaryMutationsGenerateMutation } from "@api/mutations/__generated__/WeeklyClientSummaryMutationsGenerateMutation.graphql";
import type { WeeklyClientSummaryMutationsSaveMutation } from "@api/mutations/__generated__/WeeklyClientSummaryMutationsSaveMutation.graphql";
import type { WeeklyClientSummaryMutationsReviewedMutation } from "@api/mutations/__generated__/WeeklyClientSummaryMutationsReviewedMutation.graphql";
import {
  isEdited,
  isLatestMonth,
  isLatestWeek,
  mailtoHref,
  monthLabel,
  recapBasis,
  shiftMonth,
  shiftWeek,
  statusLine,
  weekLabel,
  writtenLine,
  type SummaryPeriod,
} from "@/lib/weeklySummary";

/**
 * Client summaries: Ignite staff only (route is wrapped in AdminOnly, and
 * the server returns nothing to anyone else).
 *
 * One short written summary per brand for a finished week, and a client
 * email draft per brand for a finished month. Scheduled jobs draft them;
 * here staff read a draft, fix the wording, copy it, and mark it reviewed.
 * Nothing on this page sends anything to a brand: "Open in email" hands the
 * text to the person's own mail program with no recipient filled in.
 */

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;

type Week = NonNullable<WeekQueryType["response"]["weeklyClientSummaries"]>;
type Row = Week["rows"][number];
type Summary = NonNullable<Row["summary"]>;

const BrandSummary: React.FC<{
  row: Row;
  weekStart: string;
  period: SummaryPeriod;
  first: boolean;
}> = ({ row, weekStart, period, first }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [summary, setSummary] = useState<Summary | null>(row.summary ?? null);
  const [text, setText] = useState(row.summary?.text ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  const [generate, writing] = useMutation<WeeklyClientSummaryMutationsGenerateMutation>(
    GenerateWeeklyClientSummaryMutation,
  );
  const [save, saving] = useMutation<WeeklyClientSummaryMutationsSaveMutation>(
    SaveWeeklyClientSummaryMutation,
  );
  const [review, reviewing] = useMutation<WeeklyClientSummaryMutationsReviewedMutation>(
    SetWeeklyClientSummaryReviewedMutation,
  );
  const busy = writing || saving || reviewing;

  const take = (
    result: { ok: boolean; reason: string | null | undefined; summary: Summary | null | undefined },
    fallback: string,
    keepText = false,
  ): boolean => {
    if (!result.ok || !result.summary) {
      setProblem(result.reason || fallback);
      return false;
    }
    setProblem(null);
    setSummary(result.summary);
    if (!keepText) setText(result.summary.text);
    return true;
  };

  const dirty = summary ? isEdited(text, summary.text) : false;
  const reviewed = summary?.status === "reviewed";

  const write = () => {
    if (busy) return;
    if (
      summary &&
      (dirty || summary.editedBody.trim() || reviewed) &&
      !window.confirm(
        "Write this again? The current text, including any edits, will be replaced and it goes back to draft.",
      )
    ) {
      return;
    }
    generate({
      variables: { tenantId: row.tenantId, weekStart, period },
      onCompleted: (res) => {
        take(res.generateWeeklyClientSummary, "The summary could not be written right now.");
      },
      onError: () => setProblem("The summary could not be written right now."),
    });
  };

  const saveEdits = (then?: (saved: Summary) => void) => {
    if (!summary || busy) return;
    save({
      variables: { id: summary.id, editedBody: text },
      onCompleted: (res) => {
        const result = res.saveWeeklyClientSummary;
        if (take(result, "The edit could not be saved.") && result.summary) {
          if (then) then(result.summary);
          else showAlert("Saved.", "success");
        }
      },
      onError: () => setProblem("The edit could not be saved."),
    });
  };

  const setReviewed = (id: string, next: boolean) => {
    review({
      variables: { id, reviewed: next },
      onCompleted: (res) => {
        take(res.setWeeklyClientSummaryReviewed, "That could not be saved.", true);
      },
      onError: () => setProblem("That could not be saved."),
    });
  };

  const toggleReviewed = () => {
    if (!summary || busy) return;
    // Marking it reviewed keeps what is in the box, so save that first.
    if (!reviewed && dirty) saveEdits((saved) => setReviewed(saved.id, true));
    else setReviewed(summary.id, !reviewed);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.trim());
      showAlert("Copied.", "success");
    } catch {
      showAlert("Could not copy. Select the text and copy it by hand.", "error");
    }
  };

  const boxId = `client-summary-${period}-${row.tenantId}`;
  const monthly = period === "month";

  return (
    <li
      className="py-6 first:pt-0 last:pb-0"
      style={first ? undefined : { borderTop: "1px solid var(--spark-border)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold" style={{ color: "var(--spark-text)" }}>
          <label htmlFor={boxId}>{row.tenantName}</label>
        </h2>
        {summary ? (
          <p className="text-xs" style={reviewed ? SECONDARY : META}>
            {statusLine(summary)}
          </p>
        ) : null}
      </div>
      <p className="text-xs mt-1" style={META}>
        {recapBasis(row.approvedRecaps, row.pendingRecaps, period)}
      </p>

      {summary ? (
        <>
          <textarea
            id={boxId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={monthly ? 12 : 9}
            disabled={busy}
            className="spark-input w-full mt-3 rounded-xl px-3 py-2.5 text-sm leading-relaxed"
            style={{ resize: "vertical" }}
          />
          <p className="text-xs mt-1.5" style={META}>
            {writtenLine(summary)}
            {dirty ? " You have changes that are not saved." : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={() => saveEdits()}
              disabled={busy || !dirty}
              style={{ opacity: busy || !dirty ? 0.5 : 1 }}
            >
              {saving ? "Saving" : "Save edits"}
            </button>
            <button type="button" className="spark-btn-ghost" onClick={copy} disabled={!text.trim()}>
              Copy
            </button>
            {monthly && text.trim() ? (
              <a
                className="spark-btn-ghost"
                href={mailtoHref(`${row.tenantName}: ${monthLabel(weekStart)}`, text)}
              >
                Open in email
              </a>
            ) : null}
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={toggleReviewed}
              disabled={busy}
            >
              {reviewed ? "Back to draft" : "Mark reviewed"}
            </button>
            <button type="button" className="spark-btn-ghost" onClick={write} disabled={busy}>
              {writing ? "Writing" : "Write again"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <p className="text-sm" style={META}>
            {monthly ? "No email drafted for this month yet." : "No summary written for this week yet."}
          </p>
          {row.approvedRecaps > 0 ? (
            <button type="button" className="spark-btn-ghost" onClick={write} disabled={busy}>
              {writing ? "Writing" : monthly ? "Write draft" : "Write summary"}
            </button>
          ) : null}
        </div>
      )}

      {problem ? (
        <p className="text-sm mt-2" role="status" style={{ color: "var(--spark-orange)" }}>
          {problem}
        </p>
      ) : null}
    </li>
  );
};

const WeekBody: React.FC<{
  period: SummaryPeriod;
  weekStart: string | null;
  onWeek: (weekStart: string) => void;
}> = ({ period, weekStart, onWeek }) => {
  const data = useLazyLoadQuery<WeekQueryType>(
    WeeklyClientSummariesQuery,
    { weekStart, period },
    { fetchPolicy: "store-and-network" },
  );
  const week = data.weeklyClientSummaries;

  // With no week asked for, the server answers with the last finished one;
  // the arrows step from whichever week came back.

  if (!week) {
    return (
      <p className="text-sm" style={META}>
        Client summaries are for Ignite staff.
      </p>
    );
  }

  const monthly = period === "month";
  const latest = monthly ? isLatestMonth(week.weekStart) : isLatestWeek(week.weekStart);
  const step = (by: number) =>
    onWeek(monthly ? shiftMonth(week.weekStart, by) : shiftWeek(week.weekStart, by));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="spark-btn-ghost"
          onClick={() => step(-1)}
        >
          {monthly ? "Earlier month" : "Earlier week"}
        </button>
        <p className="text-sm font-medium" style={{ color: "var(--spark-text)" }}>
          {monthly ? monthLabel(week.weekStart) : weekLabel(week.weekStart, week.weekEnd)}
        </p>
        <button
          type="button"
          className="spark-btn-ghost"
          onClick={() => step(1)}
          disabled={latest}
          style={{ opacity: latest ? 0.5 : 1 }}
        >
          {monthly ? "Later month" : "Later week"}
        </button>
      </div>

      <section className="spark-card p-5 sm:p-6">
        {week.rows.length === 0 ? (
          <p className="text-sm" style={META}>
            No brand has an approved or waiting recap for this {period}.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {week.rows.map((row, i) => (
              <BrandSummary
                key={`${period}|${week.weekStart}|${row.tenantId}`}
                row={row}
                weekStart={week.weekStart}
                period={period}
                first={i === 0}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

export default function SparkWeeklySummaries() {
  const [period, setPeriod] = useState<SummaryPeriod>("week");
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const choose = (next: SummaryPeriod) => {
    if (next === period) return;
    // Start each view on its own last finished week or month.
    setWeekStart(null);
    setPeriod(next);
  };
  return (
    <Layout>
      <div className="spark-scale max-w-3xl flex flex-col gap-5">
        <SparkPageHeader
          title="Client summaries"
          support="A short summary of each brand's week, and an email draft for each month, by event date. Written by AI from approved recaps. Read it, fix the wording, then copy it. Nothing is sent from this page."
        />
        <p className="text-xs sm:hidden" style={META}>
          Written by AI from approved recaps. Nothing is sent from this page.
        </p>
        <div className="pill-group self-start" role="group" aria-label="Period">
          {(["week", "month"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => choose(key)}
              className={`pill-btn ${period === key ? "on" : ""}`}
            >
              {key === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <ErrorBoundary
          key={`${period}|${weekStart ?? "latest"}`}
          fallback={
            <p className="text-sm" style={META}>
              Client summaries could not load.
            </p>
          }
        >
          <Suspense
            fallback={
              <p className="text-sm" style={META}>
                Loading
              </p>
            }
          >
            <WeekBody period={period} weekStart={weekStart} onWeek={setWeekStart} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </Layout>
  );
}
