import { useState } from "react";

/**
 * Presentational ops card. No Relay imports, so unit tests can render it
 * before the Relay compiler has generated query artifacts.
 * Dark ops surface — do not place this inside the light RecapDocument paper.
 */

export type ReviewerFlag = {
  readonly code: string;
  readonly label: string;
  readonly severity: string;
};

export type ReviewerFeedback = {
  readonly themes: readonly string[];
  readonly competitorProducts: readonly string[];
  readonly objections: readonly string[];
  readonly purchaseIntent: string | null | undefined;
  readonly quotes: readonly string[];
};

export type ReviewerSummaryData = {
  readonly whatHappened: string;
  readonly followUpQuestion: string;
  readonly cached: boolean;
  readonly source: string;
  readonly looksOff: readonly ReviewerFlag[];
  readonly feedback: ReviewerFeedback | null | undefined;
};

const INTENT_LABEL: Record<string, string> = {
  likely: "Likely to buy",
  unlikely: "Unlikely to buy",
  mixed: "Mixed purchase intent",
};

const chip = {
  color: "#c5f546",
  border: "1px solid rgba(197,245,70,0.35)",
  background: "rgba(197,245,70,0.08)",
};

export function RecapReviewerSummaryCard({
  summary,
  summarizing,
  onSummarize,
  onCopied,
}: {
  summary: ReviewerSummaryData;
  summarizing?: boolean;
  onSummarize?: () => void;
  onCopied?: (ok: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const flags = summary.looksOff ?? [];
  const feedback = summary.feedback;
  const showSummarize = summary.source !== "model" && Boolean(onSummarize);
  const fromModel = summary.source === "model";

  const copyQuestion = async () => {
    const text = summary.followUpQuestion?.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.(true);
    } catch {
      onCopied?.(false);
    }
  };

  return (
    <section
      data-no-print=""
      data-recap-reviewer=""
      className="rounded-2xl p-5"
      style={{
        background: "#0A0B0D",
        color: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(197,245,70,0.35)",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#c5f546" }}>
            Reviewer summary
          </p>
          <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>
            {fromModel
              ? summary.cached
                ? "Cached from the filed recap. Approval stays manual."
                : "From the filed recap. Approval stays manual."
              : "From the filed fields and rule checks. Approval stays manual."}
          </p>
        </div>
        {showSummarize ? (
          <button
            type="button"
            onClick={onSummarize}
            disabled={summarizing}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "#c5f546",
              color: "#0A0B0D",
              opacity: summarizing ? 0.6 : 1,
            }}
          >
            {summarizing ? "Summarizing…" : "Summarize"}
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-relaxed">{summary.whatHappened}</p>

      <div className="mt-4">
        <p className="text-xs font-semibold" style={{ color: "#c5f546" }}>
          What looks off
        </p>
        {flags.length === 0 ? (
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
            Nothing in the rule checks stands out.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {flags.map((flag) => (
              <li key={`${flag.code}-${flag.label}`} className="text-sm">
                {flag.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {feedback ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {feedback.themes.map((theme) => (
            <span key={`theme-${theme}`} className="text-xs px-2 py-1 rounded-full" style={chip}>
              {theme}
            </span>
          ))}
          {feedback.competitorProducts.map((name) => (
            <span key={`comp-${name}`} className="text-xs px-2 py-1 rounded-full" style={chip}>
              Competitor: {name}
            </span>
          ))}
          {feedback.objections.map((item) => (
            <span key={`obj-${item}`} className="text-xs px-2 py-1 rounded-full" style={chip}>
              {item}
            </span>
          ))}
          {feedback.purchaseIntent && INTENT_LABEL[feedback.purchaseIntent] ? (
            <span className="text-xs px-2 py-1 rounded-full" style={chip}>
              {INTENT_LABEL[feedback.purchaseIntent]}
            </span>
          ) : null}
        </div>
      ) : null}

      {summary.followUpQuestion ? (
        <div className="mt-4 flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm flex-1 min-w-[16rem]">
            <span className="font-semibold" style={{ color: "#c5f546" }}>
              Ask the BA:{" "}
            </span>
            {summary.followUpQuestion}
          </p>
          <button
            type="button"
            onClick={copyQuestion}
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "#c5f546",
              border: "1px solid rgba(197,245,70,0.45)",
            }}
          >
            {copied ? "Copied" : "Copy question"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
