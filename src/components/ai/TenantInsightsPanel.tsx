import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantInsightsQuery } from "@/api/queries/TenantInsightsQuery";
import type { TenantInsightsQuery as TenantInsightsQueryType } from "@api/queries/__generated__/TenantInsightsQuery.graphql";

/**
 * Bucket scoreboard panel for the dashboards.
 *
 * Loads `tenantInsights` for ONE client (tenant) and renders a fixed set of
 * deterministic buckets as scoreboard tiles — each tile a small UPPERCASE mono
 * category label (`title`), a big headline number (`metric`), a one-line
 * takeaway (`detail`), and a leading icon mapped from the bucket `key`
 * (reach / sampling / sales / new_audience / momentum). The visual deliberately
 * matches <TenantKpiCharts>'s StatTile so Insights and KPIs read as one
 * dashboard: a calm `spark-card` dark tile with a subtle top-border accent —
 * not a wall of colored alerts. A restrained amber accent is reserved ONLY for
 * `sentiment === "attention"`; everything else stays calm/neutral.
 *
 * Mounted on both dashboards (admin DashboardEvent and the client
 * SparkClientDashboard) near the KPI charts / Ask-AI button, scoped to the
 * active tenant via `useAuthStore().tenantId`, the same id every per-tenant
 * surface uses. The caller renders nothing when no tenant is in scope; this
 * component is wrapped in a <Suspense> by the dashboard (same as the other
 * lazy-loaded dashboard cards) so it loads the data the app's usual way and
 * doesn't block first paint.
 *
 * A small "UPDATED …" caption shows when the buckets were last computed. When
 * the tenant has nothing worth surfacing yet (`items` empty) we show a quiet
 * empty state instead.
 */

// Restrained accent reserved for the "attention" sentiment. Every other
// sentiment (positive / neutral / unknown) renders the same calm tile with a
// muted top border, so the scoreboard stays scannable rather than alarm-heavy.
const ATTENTION_ACCENT = "var(--spark-gold)";
const CALM_ACCENT = "var(--spark-border)";

const accentFor = (sentiment: string): string =>
  sentiment.toLowerCase() === "attention" ? ATTENTION_ACCENT : CALM_ACCENT;

// Bucket `key` → leading icon. Emoji is the convention across the AI surfaces
// (e.g. the "✨ Ask AI" button). Unknown / null keys fall back to a quiet dot
// so a legacy or new bucket never renders without a leading glyph.
const ICON_FOR_KEY: Record<string, string> = {
  reach: "👥",
  sampling: "🧪",
  sales: "🛒",
  new_audience: "✨",
  emails: "✉️",
  momentum: "📈",
  consumers_sampled: "👥",
};

const iconFor = (key: string | null | undefined): string =>
  (key && ICON_FOR_KEY[key.toLowerCase()]) || "•";

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

/* ───────────────────────── scoreboard tile ───────────────────────── */

// Calm scoreboard tile — same `spark-card` dark tile + top-border accent as the
// KPI StatTile (see TenantKpiCharts), so the two panels feel like one surface.
// Layout top→bottom: leading icon + UPPERCASE mono category label, then a big
// tab-num headline number (omitted gracefully when `metric` is empty), then the
// muted `detail` one-liner.
const InsightTile: React.FC<{
  title: string;
  detail: string;
  sentiment: string;
  metric?: string | null;
  insightKey?: string | null;
}> = ({ title, detail, sentiment, metric, insightKey }) => {
  const accent = accentFor(sentiment);
  const icon = iconFor(insightKey);
  const hasMetric = !!metric && metric.trim().length > 0;
  return (
    <div
      className="spark-card rounded-2xl px-4 py-4"
      style={{ borderTop: `2px solid ${accent}` }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[13px] leading-none shrink-0">
          {icon}
        </span>
        <p
          className="mono text-[9px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-text-meta)",
            textTransform: "uppercase",
          }}
        >
          {title}
        </p>
      </div>
      {hasMetric && (
        <p
          className="display tab-num font-bold mt-1.5"
          style={{
            fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "var(--spark-text)",
          }}
        >
          {metric}
        </p>
      )}
      <p
        className="text-[13px] mt-1.5 leading-relaxed"
        style={{ color: "var(--spark-text-secondary)" }}
      >
        {detail}
      </p>
    </div>
  );
};

/* ───────────────────────── panel ───────────────────────── */

const TenantInsightsPanel: React.FC<{
  tenantId: string;
  /** Inclusive page range; scopes retail-sales programs' cards. */
  startDate?: string;
  endDate?: string;
}> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<TenantInsightsQueryType>(
    TenantInsightsQuery,
    { tenantId, startDate: startDate ?? null, endDate: endDate ?? null },
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
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            {insights.scopeLabel
              ? `${insights.scopeLabel.toUpperCase()} · `
              : ""}
            UPDATED {updated.toUpperCase()}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p
          className="text-sm py-10 text-center"
          style={{ color: "var(--spark-text-meta)" }}
        >
          No insights yet — they'll appear as activity builds.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, i) => {
            // 5 fixed buckets read cleanly as a 2-col grid with the last tile
            // (momentum) spanning full width so an odd count never leaves an
            // awkward orphan. Anchored on the momentum bucket, with a fallback
            // to the trailing odd tile for legacy / shorter payloads.
            const isLastOdd =
              items.length % 2 === 1 && i === items.length - 1;
            const spanFull =
              item.key?.toLowerCase() === "momentum" || isLastOdd;
            return (
              <div
                key={`${item.key ?? item.title}-${i}`}
                className={spanFull ? "md:col-span-2" : undefined}
              >
                <InsightTile
                  title={item.title}
                  detail={item.detail}
                  sentiment={item.sentiment}
                  metric={item.metric}
                  insightKey={item.key}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TenantInsightsPanel;
