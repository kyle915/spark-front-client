import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantInsightsQuery } from "@/api/queries/TenantInsightsQuery";
import type { TenantInsightsQuery as TenantInsightsQueryType } from "@api/queries/__generated__/TenantInsightsQuery.graphql";

/**
 * Proactive Insights panel for the dashboards.
 *
 * Loads `tenantInsights` for ONE client (tenant) and renders a stack of short
 * insight cards — each a bold `title`, a `detail` line, and an optional `metric`
 * badge — color-coded by `sentiment`:
 *   - "positive"  → lime/green accent
 *   - "neutral"   → muted
 *   - "attention" → amber/orange accent
 *
 * Mounted on both dashboards (admin DashboardEvent and the client
 * SparkClientDashboard) near the KPI charts / Ask-AI button, scoped to the
 * active tenant via `useAuthStore().tenantId`, the same id every per-tenant
 * surface uses. The caller renders nothing when no tenant is in scope; this
 * component is wrapped in a <Suspense> by the dashboard (same as the other
 * lazy-loaded dashboard cards) so it loads the data the app's usual way and
 * doesn't block first paint.
 *
 * Dark-theme styled to match <TenantKpiCharts> and the dashboard cards. A small
 * "Updated …" caption shows when the insights were last computed. When the
 * tenant has nothing worth surfacing yet (`items` empty) we show a quiet empty
 * state instead.
 */

type Sentiment = "positive" | "neutral" | "attention";

type Accent = {
  color: string;
  bg: string;
  border: string;
};

// Sentiment → accent. Unknown / unexpected sentiments fall back to the muted
// (neutral) treatment so a new backend value never renders as an unstyled card.
const accentFor = (sentiment: string): Accent => {
  const s = sentiment.toLowerCase() as Sentiment;
  switch (s) {
    case "positive":
      return {
        color: "var(--spark-lime)",
        bg: "rgba(197,245,70,0.06)",
        border: "rgba(197,245,70,0.30)",
      };
    case "attention":
      return {
        color: "var(--spark-orange, #ef5a2a)",
        bg: "rgba(239,90,42,0.07)",
        border: "rgba(239,90,42,0.32)",
      };
    case "neutral":
    default:
      return {
        color: "rgba(255,255,255,0.55)",
        bg: "rgba(255,255,255,0.03)",
        border: "var(--spark-border)",
      };
  }
};

/**
 * Format the `generatedAt` timestamp into a short, friendly caption: a relative
 * phrase for recent values ("just now", "5 min ago", "3 hr ago", "2 days ago")
 * and a short date for anything older / undatable. Returns null when there's
 * nothing usable to show so the caller can omit the caption entirely.
 */
const formatUpdated = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  if (!Number.isFinite(ms)) return null;
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 0) return "just now";
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

/* ───────────────────────── insight card ───────────────────────── */

const InsightCard: React.FC<{
  title: string;
  detail: string;
  sentiment: string;
  metric?: string | null;
}> = ({ title, detail, sentiment, metric }) => {
  const accent = accentFor(sentiment);
  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: accent.bg,
        border: `1px solid ${accent.border}`,
        borderLeft: `3px solid ${accent.color}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="font-bold text-sm leading-snug"
          style={{ color: "var(--spark-text)", letterSpacing: "-0.01em" }}
        >
          {title}
        </p>
        {metric && (
          <span
            className="mono text-[10px] tab-num px-2 py-1 rounded-full shrink-0"
            style={{
              letterSpacing: "0.10em",
              color: accent.color,
              background: accent.bg,
              border: `1px solid ${accent.border}`,
            }}
          >
            {metric}
          </span>
        )}
      </div>
      <p
        className="text-[13px] mt-1.5 leading-relaxed"
        style={{ color: "rgba(255,255,255,0.65)" }}
      >
        {detail}
      </p>
    </div>
  );
};

/* ───────────────────────── panel ───────────────────────── */

const TenantInsightsPanel: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<TenantInsightsQueryType>(
    TenantInsightsQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const insights = data?.tenantInsights;
  const items = useMemo(() => insights?.items ?? [], [insights]);
  const updated = formatUpdated(insights?.generatedAt);

  if (!insights) return null;

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Insights
        </h2>
        {updated && (
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            UPDATED {updated.toUpperCase()}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p
          className="text-sm py-10 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No insights yet — they'll appear as activity builds.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, i) => (
            <InsightCard
              key={`${item.title}-${i}`}
              title={item.title}
              detail={item.detail}
              sentiment={item.sentiment}
              metric={item.metric}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TenantInsightsPanel;
