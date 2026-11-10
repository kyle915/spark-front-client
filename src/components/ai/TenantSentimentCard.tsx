import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantSentimentQuery } from "@/api/queries/TenantSentimentQuery";
import type { TenantSentimentQuery as TenantSentimentQueryType } from "@api/queries/__generated__/TenantSentimentQuery.graphql";

/**
 * "What people are saying" — consumer-sentiment card for the dashboards
 * (Insights bucket #6).
 *
 * Loads `tenantSentiment` for ONE client (tenant), all-time, and renders an AI
 * rollup of the VERBATIM consumer-feedback text captured across that tenant's
 * recaps: a prominent positive % with a thin accent-colored progress bar, a
 * readable summary, the recurring themes as tone-tinted chips, and the real
 * consumer quotes as clean quote blocks. Dark-theme styled to match
 * <TenantInsightsPanel> / <TenantKpiCharts> so it reads as one dashboard — the
 * same calm `spark-card` chrome, mono UPPERCASE captions, and spark CSS vars.
 *
 * Mounted right AFTER <TenantInsightsPanel> everywhere that panel is (the admin
 * home dashboard, the client dashboard, and the admin client-detail page),
 * scoped to the same tenant id each site uses. The caller renders nothing when
 * no tenant is in scope; this component is wrapped in a <Suspense> by the site
 * (same as the other lazy-loaded dashboard cards) so it loads the data the
 * app's usual way and doesn't block first paint.
 *
 * `tenantSentiment` resolves to null when the tenant doesn't have enough
 * consumer-feedback text yet to summarize — in that case we `return null` (NO
 * card, no empty frame), because many tenants won't have feedback text yet. A
 * small "UPDATED …" caption shows when the summary was last computed.
 */

/**
 * Accent for the overall sentiment. Positive leans on the brand lime; mixed on
 * the calm gold the rest of the dashboard reserves for "needs a look"; negative
 * on the restrained spark-orange (the same hue the KPI deltas use for a down
 * move) — deliberately NOT an alarm red, so the card stays calm.
 */
const OVERALL_ACCENT: Record<string, string> = {
  positive: "var(--spark-lime)",
  mixed: "var(--spark-gold)",
  negative: "var(--spark-orange)",
};

const accentForOverall = (overall: string): string =>
  OVERALL_ACCENT[overall.toLowerCase()] ?? "var(--spark-lime)";

/**
 * Tone palette for themes / quotes. positive → lime, negative → the restrained
 * amber-red (spark-orange), neutral / unknown → a muted neutral so it sits
 * quietly. Each tone carries its solid `text` color (for the quote glyph / chip
 * label) plus matching rgba `bg` / `border` tints — explicit rgba literals,
 * the same way <TenantKpiCharts> and the client dashboard tint their bone pills
 * (e.g. `rgba(242,243,238,0.08)`), rather than alpha-suffixing a CSS var.
 */
type TonePalette = { text: string; bg: string; border: string };

const TONE_PALETTE: Record<string, TonePalette> = {
  // bone #f2f3ee → 242,243,238
  positive: {
    text: "var(--spark-lime)",
    bg: "rgba(242,243,238,0.10)",
    border: "rgba(242,243,238,0.30)",
  },
  // orange #ef5a2a → 239,90,42 (restrained, not an alarm red)
  negative: {
    text: "var(--spark-orange)",
    bg: "rgba(239,90,42,0.10)",
    border: "rgba(239,90,42,0.32)",
  },
  neutral: {
    text: "rgba(255,255,255,0.62)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.14)",
  },
};

const paletteForTone = (tone: string): TonePalette =>
  TONE_PALETTE[tone.toLowerCase()] ?? TONE_PALETTE.neutral;

/**
 * Format the `generatedAt` timestamp into a short, friendly caption — a relative
 * phrase for recent values ("just now", "5 min ago", "3 hr ago", "2 days ago")
 * and a short date for anything older / undatable. Returns null when there's
 * nothing usable so the caller can omit the caption. Mirrors the formatter in
 * <TenantInsightsPanel> (not exported there, so kept local here).
 */
const formatUpdated = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  if (!Number.isFinite(ms)) return null;
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 60) return "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/* ───────────────────────── theme chip ───────────────────────── */

// Small tone-tinted pill — same rounded mono pill the dashboards use elsewhere
// (e.g. SparkClientDashboard's retailer counts), tinted from the theme tone.
const ThemeChip: React.FC<{ label: string; tone: string }> = ({
  label,
  tone,
}) => {
  const pal = paletteForTone(tone);
  return (
    <span
      className="text-[12px] px-2.5 py-1 rounded-full inline-flex items-center"
      style={{
        color: pal.text,
        background: pal.bg,
        border: `1px solid ${pal.border}`,
      }}
    >
      {label}
    </span>
  );
};

/* ───────────────────────── quote block ───────────────────────── */

// Verbatim consumer quote — leading curly open-quote, italic body, and a subtle
// tone-colored left border. These are real consumer words; rendered as-is.
const QuoteBlock: React.FC<{ text: string; tone: string }> = ({
  text,
  tone,
}) => {
  const pal = paletteForTone(tone);
  return (
    <blockquote
      className="rounded-r-lg pl-4 pr-3 py-2.5"
      style={{
        borderLeft: `3px solid ${pal.border}`,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <p
        className="text-[14px] italic leading-relaxed"
        style={{ color: "var(--spark-text)" }}
      >
        <span aria-hidden="true" style={{ color: pal.text }}>
          &ldquo;
        </span>
        {text}
      </p>
    </blockquote>
  );
};

/* ───────────────────────── card ───────────────────────── */

const TenantSentimentCard: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<TenantSentimentQueryType>(
    TenantSentimentQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const sentiment = data?.tenantSentiment;
  const themes = useMemo(() => sentiment?.themes ?? [], [sentiment]);
  const quotes = useMemo(() => sentiment?.quotes ?? [], [sentiment]);
  const updated = formatUpdated(sentiment?.generatedAt);

  // Not enough consumer-feedback text yet → render NOTHING (no empty frame).
  // Many tenants won't have feedback text, so the card simply doesn't appear.
  if (!sentiment) return null;

  const accent = accentForOverall(sentiment.overallSentiment);
  // Clamp to a sane 0–100 bar width even if the backend ever sends an outlier.
  const pct = Math.max(0, Math.min(100, sentiment.positivePct));

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="min-w-0">
          <h2
            className="display text-lg lg:text-xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            What people are saying
          </h2>
          <p
            className="text-[13px] mt-1"
            style={{ color: "var(--spark-text-meta)" }}
          >
            based on {sentiment.sampleSize.toLocaleString()} piece
            {sentiment.sampleSize === 1 ? "" : "s"} of consumer feedback
          </p>
        </div>
        {updated && (
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            UPDATED {updated.toUpperCase()}
          </p>
        )}
      </div>

      {/* Overall sentiment — prominent positive % + thin accent progress bar. */}
      <div className="mb-5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="display tab-num font-bold"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: accent,
            }}
          >
            {pct}%
          </span>
          <span
            className="mono text-[11px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-text-meta)",
              textTransform: "uppercase",
            }}
          >
            positive · {sentiment.overallSentiment}
          </span>
        </div>
        <div
          className="mt-2.5 h-1.5 w-full rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Positive consumer sentiment"
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>
      </div>

      {/* Summary — readable body text. */}
      <p
        className="text-[15px] leading-relaxed"
        style={{ color: "var(--spark-text-secondary)" }}
      >
        {sentiment.summary}
      </p>

      {/* Themes — tone-tinted chips. */}
      {themes.length > 0 && (
        <div className="mt-5">
          <p
            className="mono text-[10px] mb-2.5"
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            THEMES
          </p>
          <div className="flex flex-wrap gap-2">
            {themes.map((t, i) => (
              <ThemeChip key={`${t.label}-${i}`} label={t.label} tone={t.tone} />
            ))}
          </div>
        </div>
      )}

      {/* Quotes — verbatim consumer words, rendered as-is. */}
      {quotes.length > 0 && (
        <div className="mt-5">
          <p
            className="mono text-[10px] mb-2.5"
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            IN THEIR WORDS
          </p>
          <div className="space-y-2.5">
            {quotes.map((q, i) => (
              <QuoteBlock key={`${i}-${q.text.slice(0, 24)}`} text={q.text} tone={q.tone} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantSentimentCard;
