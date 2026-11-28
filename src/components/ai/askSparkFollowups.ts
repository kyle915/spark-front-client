/**
 * Contextual multi-turn follow-up prompt chips for Ask Spark (Client & Admin).
 *
 * Inspects the latest Q&A turn (question, answer text, grounded tools, and
 * current route) to propose 3 crisp next-step prompts that never repeat
 * questions already asked in the thread. Strictly program-data focused.
 */

export interface AskSparkFollowupInput {
  question: string;
  answer: string;
  sourceTools?: readonly string[];
  pathname?: string;
  priorQuestions?: readonly string[];
  maxChips?: number;
}

function normalizePrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRedundant(candidate: string, seen: readonly string[]): boolean {
  const norm = normalizePrompt(candidate);
  if (!norm) return true;
  const candWords = new Set(norm.split(" ").filter((w) => w.length > 2));
  for (const prev of seen) {
    const pNorm = normalizePrompt(prev);
    if (!pNorm) continue;
    if (pNorm === norm || pNorm.includes(norm) || norm.includes(pNorm)) {
      return true;
    }
    const prevWords = new Set(pNorm.split(" ").filter((w) => w.length > 2));
    if (candWords.size >= 3 && prevWords.size >= 3) {
      let overlap = 0;
      for (const w of candWords) {
        if (prevWords.has(w)) overlap += 1;
      }
      if (overlap / Math.min(candWords.size, prevWords.size) >= 0.72) {
        return true;
      }
    }
  }
  return false;
}

export function deriveAskSparkFollowups({
  question,
  answer,
  sourceTools = [],
  pathname = "",
  priorQuestions = [],
  maxChips = 3,
}: AskSparkFollowupInput): string[] {
  const combined = `${question} ${answer}`.toLowerCase();
  const tools = new Set(sourceTools.map((t) => t.toLowerCase()));
  const path = pathname.toLowerCase();

  const pool: string[] = [];

  // 1. Wave planning follow-ups
  if (
    tools.has("propose_demo_wave") ||
    /\b(wave|book|schedule|next month'?s|re-?activate)\b/.test(combined)
  ) {
    pool.push(
      "Show shelf & price-tag gaps in these markets",
      "Which SKUs convert best at these stores?",
      "Compare conversion across these markets",
    );
  }

  // 2. Shelf compliance / OOS / MSRP pricing follow-ups
  if (
    tools.has("shelf_summary") ||
    tools.has("shelf_voice") ||
    /\b(out[- ]of[- ]stock|oos|shelf|price tag|msrp|drift|facing)\b/.test(combined)
  ) {
    pool.push(
      "Which markets have the highest OOS rate?",
      "Check MSRP price drift across stores",
      "Draft a wave for our strongest in-stock stores",
      "Summarize shopper feedback at these stores",
    );
  }

  // 3. Top stores / doors / conversion follow-ups
  if (
    tools.has("top_stores") ||
    tools.has("store_lookup") ||
    /\b(store|door|retailer|chain|h-?e-?b|whole foods|sprouts|kroger|target|erewhon|converting)\b/.test(
      combined,
    )
  ) {
    pool.push(
      "Draft a wave for these stores",
      "Compare vs. last month",
      "Show shelf & price-tag gaps here",
      "Break down performance by SKU",
    );
  }

  // 4. POS / ROI / lift / budget follow-ups
  if (
    tools.has("pos_lift") ||
    /\b(pos|lift|roi|velocity|cost per|budget|spend|sales)\b/.test(combined)
  ) {
    pool.push(
      "Rank our top 5 converting doors",
      "Compare vs. prior 30 days",
      "Which markets drive the highest lift?",
      "Draft a wave for our top-ROI doors",
    );
  }

  // 5. Shopper feedback / themes / competitor follow-ups
  if (
    tools.has("feedback_themes") ||
    tools.has("competitor_mentions") ||
    /\b(shopper|feedback|comment|quote|competitor|flavor|taste|promo|sentiment)\b/.test(
      combined,
    )
  ) {
    pool.push(
      "Which SKUs get the strongest shopper feedback?",
      "Where are competitors running promos?",
      "Compare vs. last month",
      "Draft a wave in our top-converting markets",
    );
  }

  // 6. Route-aware enrichment
  if (path.includes("shelf")) {
    pool.push("Which stores are missing price tags?");
  } else if (path.includes("buyer") || path.includes("report")) {
    pool.push("Compare vs. last month", "Rank our top 5 converting doors");
  } else if (path.includes("schedule") || path.includes("tracker") || path.includes("request")) {
    pool.push("Draft a 15-store demo wave for next month");
  }

  // 7. Reliable evergreen program-data fallbacks
  pool.push(
    "Compare vs. last month",
    "Rank our top 5 converting doors",
    "Show shelf & price-tag gaps",
    "Break down performance by SKU",
    "Summarize top shopper themes",
  );

  const seen = [question, ...priorQuestions];
  const result: string[] = [];
  for (const candidate of pool) {
    if (result.length >= maxChips) break;
    if (isRedundant(candidate, [...seen, ...result])) continue;
    result.push(candidate);
  }
  return result;
}
