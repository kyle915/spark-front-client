import { useState, type CSSProperties } from "react";
import { card, helperText, input } from "./checkinStyles";
import type { ProductQaState } from "./checkinTypes";
import {
  AI_UNAVAILABLE,
  NO_NOTES_YET,
  QUESTION_MAX,
  askProductQuestion,
  productQaMode,
  type ProductAnswer,
} from "./productQa";
import type { FetchLike } from "./timedFetch";

const title: CSSProperties = { fontSize: 16, fontWeight: 700, margin: 0 };

/** The box's face. Pure, so every state renders in a test without a fetch. */
export function ProductQuestionsView({
  brandName,
  state,
  recapOnly,
  accent,
  question,
  busy,
  result,
  onQuestion,
  onAsk,
}: {
  brandName: string;
  state: ProductQaState | undefined | null;
  recapOnly?: boolean;
  accent: string;
  question: string;
  busy: boolean;
  result: ProductAnswer | null;
  onQuestion: (value: string) => void;
  onAsk: () => void;
}) {
  const mode = productQaMode(state, { recapOnly });
  if (mode === "hidden") return null;
  const brand = brandName.trim() || "this brand";
  const canAsk = mode === "ready" && question.trim().length >= 3 && !busy;
  return (
    <section style={card} aria-label="Product questions">
      <p style={title}>Product questions</p>
      {mode === "no_notes" ? (
        <p style={{ ...helperText, margin: "6px 0 0" }}>{NO_NOTES_YET}</p>
      ) : mode === "unavailable" ? (
        <p style={{ ...helperText, margin: "6px 0 0" }}>{AI_UNAVAILABLE}</p>
      ) : (
        <>
          <p style={{ ...helperText, margin: "4px 0 0" }}>
            Ask about {brand} products. Answers come only from {brand}'s own notes, documents
            and website.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canAsk) onAsk();
            }}
          >
            <label htmlFor="product-question" style={{ position: "absolute", left: -9999 }}>
              Your product question
            </label>
            <input
              id="product-question"
              style={input}
              value={question}
              maxLength={QUESTION_MAX}
              enterKeyHint="send"
              autoComplete="off"
              placeholder="e.g. How much caffeine is in this?"
              onChange={(e) => onQuestion(e.target.value)}
            />
            <button
              type="submit"
              disabled={!canAsk}
              style={{
                width: "100%",
                minHeight: 48,
                marginTop: 8,
                borderRadius: 12,
                border: `2px solid ${accent}`,
                background: canAsk ? accent : "#fff",
                color: "#1c1917",
                fontSize: 16,
                fontWeight: 700,
                opacity: canAsk || busy ? 1 : 0.6,
                cursor: canAsk ? "pointer" : "default",
              }}
            >
              {busy ? "Checking the notes…" : "Ask"}
            </button>
          </form>
          {result ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: result.answered ? `${accent}14` : "#f5f5f4",
                border: `1px solid ${result.answered ? `${accent}55` : "rgba(0,0,0,0.08)"}`,
              }}
            >
              <p style={{ fontSize: 15, lineHeight: 1.45, margin: 0, color: "#1c1917" }}>
                {result.answer}
              </p>
              {result.answered && result.source ? (
                <p style={{ ...helperText, fontSize: 12, margin: "6px 0 0" }}>{result.source}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * Mid-shift product questions for the BA at the table. Answers are short and
 * drawn only from the brand's notes, catalog, training, uploaded documents
 * and its own website — never the open web.
 */
export function ProductQuestionsBox({
  origin,
  code,
  session,
  brandName,
  state,
  recapOnly,
  accent,
  fetchImpl,
}: {
  origin: string;
  code: string;
  session: string;
  brandName: string;
  state: ProductQaState | undefined | null;
  recapOnly?: boolean;
  accent: string;
  fetchImpl: FetchLike;
}) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProductAnswer | null>(null);

  const ask = async () => {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    const answer = await askProductQuestion({ origin, code, session, question: q, fetchImpl });
    setResult(answer);
    setBusy(false);
  };

  return (
    <ProductQuestionsView
      brandName={brandName}
      state={state}
      recapOnly={recapOnly}
      accent={accent}
      question={question}
      busy={busy}
      result={result}
      onQuestion={setQuestion}
      onAsk={() => void ask()}
    />
  );
}

export default ProductQuestionsBox;
