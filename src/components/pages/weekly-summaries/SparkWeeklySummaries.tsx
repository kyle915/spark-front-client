import { Suspense, useState } from "react";
import { useSearchParams } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
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
  monthLabel,
  recapBasis,
  shiftMonth,
  shiftWeek,
  statusLine,
  weekLabel,
  writtenLine,
  type SummaryPeriod,
} from "@/lib/weeklySummary";
import StoreInsightsReview from "@/components/pages/weekly-summaries/StoreInsightsReview";
import SendWeeklySummaryModal from "@/components/pages/weekly-summaries/SendWeeklySummaryModal";

/**
 * Client summaries: Ignite staff only (route is wrapped in AdminOnly, and
 * the server returns nothing to anyone else).
 *
 * One short written summary per brand for a finished week, and a client
 * email draft per brand for a finished month. Scheduled jobs draft them;
 * here staff read a draft, fix the wording, mark it reviewed, and Send
 * branded HTML to brand recipients (stamps sentAt / sentBy).
 */

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;

type Week = NonNullable<WeekQueryType["response"]["weeklyClientSummaries"]>;
type Row = Week["rows"][number];
type Summary = NonNullable<Row["summary"]>;

const BrandSummary: React.FC<{
  row: Row;
  weekStart: string;
  weekEnd: string;
  period: SummaryPeriod;
  first: boolean;
}> = ({ row, weekStart, weekEnd, period, first }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [summary, setSummary] = useState<Summary | null>(row.summary ?? null);
  const [text, setText] = useState(row.summary?.text ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

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

  const openSend = () => {
    if (!summary || busy || !text.trim()) return;
    if (dirty) {
      saveEdits((saved) => {
        setSummary(saved);
        setSendOpen(true);
      });
      return;
    }
    setSendOpen(true);
  };

  const boxId = `client-summary-${period}-${row.tenantId}`;
  const monthly = period === "month";
  const periodLabel = monthly
    ? monthLabel(weekStart)
    : weekLabel(weekStart, weekEnd);

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
          <p className="text-xs" style={summary.sentAt || reviewed ? SECONDARY : META}>
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
            <button
              type="button"
              className="spark-btn-primary"
              onClick={openSend}
              disabled={busy || !text.trim()}
              style={{ opacity: busy || !text.trim() ? 0.5 : 1 }}
            >
              {summary.sentAt ? "Send again" : "Send"}
            </button>
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

      {sendOpen && summary ? (
        <SendWeeklySummaryModal
          summaryId={summary.id}
          tenantName={row.tenantName}
          periodLabel={periodLabel}
          suggestedRecipients={row.suggestedRecipients ?? []}
          onClose={() => setSendOpen(false)}
          onSent={(next) => {
            setSummary(next);
            setText(next.text);
            setProblem(null);
          }}
        />
      ) : null}
    </li>
  );
};

const WeekBody: React.FC<{
  period: SummaryPeriod;
  weekStart: string | null;
  onWeek: (weekStart: string) => void;
}> = ({ period, weekStart, onWeek }) => {
  const { tenantId: activeTenantId } = useAuthStore();
  const [scopeMode, setScopeMode] = useState<"workspace" | "all">(() =>
    activeTenantId ? "workspace" : "all",
  );
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

  const scopedRows =
    scopeMode === "workspace" && activeTenantId
      ? week.rows.filter((r) => String(r.tenantId) === String(activeTenantId))
      : week.rows;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        {activeTenantId && (
          <div className="pill-group" role="group" aria-label="Workspace scope">
            <button
              type="button"
              onClick={() => setScopeMode("workspace")}
              className={`pill-btn ${scopeMode === "workspace" ? "on" : ""}`}
            >
              This workspace
            </button>
            <button
              type="button"
              onClick={() => setScopeMode("all")}
              className={`pill-btn ${scopeMode === "all" ? "on" : ""}`}
            >
              All brands ({week.rows.length})
            </button>
          </div>
        )}
      </div>

      <section className="spark-card p-5 sm:p-6">
        {scopedRows.length === 0 ? (
          <div className="text-sm flex flex-wrap items-center gap-3" style={META}>
            <span>
              No approved or waiting recaps for{" "}
              {scopeMode === "workspace" ? "this workspace" : "any brand"} in this {period}.
            </span>
            {scopeMode === "workspace" && week.rows.length > 0 ? (
              <button
                type="button"
                onClick={() => setScopeMode("all")}
                className="underline font-semibold"
                style={{ color: "var(--spark-text)" }}
              >
                Show all {week.rows.length} brands →
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="m-0 p-0 list-none">
            {scopedRows.map((row, i) => (
              <BrandSummary
                key={`${period}|${week.weekStart}|${row.tenantId}`}
                row={row}
                weekStart={week.weekStart}
                weekEnd={week.weekEnd}
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

type View = SummaryPeriod | "insights";

const VIEW_LABELS: Record<View, string> = {
  week: "Weekly",
  month: "Monthly",
  insights: "Store insights",
};

export default function SparkWeeklySummaries() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "insights" ? "insights" : params.get("view") === "month" ? "month" : "week";
  const period: SummaryPeriod = view === "month" ? "month" : "week";
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const choose = (next: View) => {
    if (next === view) return;
    // Start each view on its own last finished week or month.
    setWeekStart(null);
    const nextParams = new URLSearchParams(params);
    if (next === "week") nextParams.delete("view");
    else nextParams.set("view", next);
    setParams(nextParams, { replace: true });
  };
  return (
    <Layout>
      <div className="spark-scale max-w-3xl flex flex-col gap-5">
        <SparkPageHeader
          title="Client summaries"
          support="A short summary of each brand's week, an email draft for each month, and store recommendations and alerts for each brand's dashboard. Written from approved recaps. Use Send to email the branded HTML to brand recipients."
        />
        <p className="text-xs sm:hidden" style={META}>
          Written from approved recaps. Use Send to email the branded summary to the brand.
        </p>
        <div className="pill-group self-start" role="group" aria-label="View">
          {(["week", "month", "insights"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => choose(key)}
              className={`pill-btn ${view === key ? "on" : ""}`}
            >
              {VIEW_LABELS[key]}
            </button>
          ))}
        </div>
        {view === "insights" ? (
          <p className="text-sm" style={SECONDARY}>
            Where to go next and alerts, worked out each day from approved recaps. A brand sees a
            finding only once it is published here. Publishing sends nothing.
          </p>
        ) : null}
        <ErrorBoundary
          key={`${view}|${weekStart ?? "latest"}`}
          fallback={
            <p className="text-sm" style={META}>
              {view === "insights" ? "Store insights could not load." : "Client summaries could not load."}
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
            {view === "insights" ? (
              <StoreInsightsReview />
            ) : (
              <WeekBody period={period} weekStart={weekStart} onWeek={setWeekStart} />
            )}
          </Suspense>
        </ErrorBoundary>
      </div>
    </Layout>
  );
}
