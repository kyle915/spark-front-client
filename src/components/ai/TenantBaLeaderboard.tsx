import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantBaLeaderboardQuery } from "@/api/queries/TenantBaLeaderboardQuery";
import type { TenantBaLeaderboardQuery as TenantBaLeaderboardQueryType } from "@api/queries/__generated__/TenantBaLeaderboardQuery.graphql";

/**
 * "Top performers" BA leaderboard card for the dashboards.
 *
 * Loads `tenantBaLeaderboard` for ONE client (tenant) and renders a compact
 * ranked list of the brand ambassadors who worked that tenant's program. The
 * backend returns the rows already sorted (avgRating desc → recapsFiled desc →
 * shiftsWorked desc) and capped, so we just render: a rank number, the BA
 * `name`, an avg-rating display (★ + "4.6 (12)", or "—" when unrated), and the
 * BA's `shiftsWorked` / `recapsFiled` as small muted stats. Dark-theme styled
 * with the same `spark-card` chrome / fonts / spark CSS vars as
 * <TenantKpiCharts> and <TenantInsightsPanel> so the analytics cards read as one
 * surface.
 *
 * Mounted on both dashboards (admin DashboardEvent and the client
 * SparkClientDashboard) near the other analytics cards, scoped to the active
 * tenant via `useAuthStore().tenantId`, the same id every per-tenant surface
 * uses. The caller renders nothing when no tenant is in scope; this component is
 * wrapped in a <Suspense> by the dashboard (same as the other lazy-loaded
 * dashboard cards) so it loads the data the app's usual way and doesn't block
 * first paint.
 *
 * To stay scannable the card shows at most the top {VISIBLE_LIMIT}; if the
 * backend returns more, a muted "+N more" line stands in for the tail rather
 * than rendering a giant list, and the list itself is height-bounded with an
 * internal scroll.
 *
 * `reliabilityPct` is reserved for a future on-time/reliability score and is
 * currently always null from the backend, so we hide that stat entirely unless
 * at least one entry has a non-null value (future-proofing for when the data
 * lands).
 *
 * Empty state: when `tenantBaLeaderboard` is [] we show a quiet
 * "No BA performance data yet" card instead of an empty list.
 */

// Keep the card compact so it doesn't dominate the dashboard: render the top N
// rows inline and collapse any remainder into a single muted "+N more" line.
const VISIBLE_LIMIT = 10;

const STAR = "★";
const GOLD = "var(--spark-gold)";
const STAR_EMPTY = "rgba(255,255,255,0.18)";

type Entry = TenantBaLeaderboardQueryType["response"]["tenantBaLeaderboard"][number];

/* ───────────────────────── rating display ───────────────────────── */

// Compact avg-rating cell: five stars filled up to the rounded average, then the
// numeric average and its ratings count in parens ("4.6 (12)"). When the BA is
// unrated (`avgRating` null) we render a quiet "—" instead of an all-empty star
// row so unrated BAs read as "no data", not "zero stars".
const RatingCell: React.FC<{
  avgRating: number | null | undefined;
  ratingsCount: number;
}> = ({ avgRating, ratingsCount }) => {
  if (avgRating == null) {
    return (
      <span
        className="text-[13px]"
        style={{ color: "rgba(255,255,255,0.4)" }}
        title="Unrated"
      >
        —
      </span>
    );
  }
  const filled = Math.round(avgRating);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${avgRating.toFixed(1)} / 5 · ${ratingsCount} rating${ratingsCount === 1 ? "" : "s"}`}
    >
      <span aria-hidden="true" className="inline-flex" style={{ letterSpacing: "1px" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="text-[12px] leading-none"
            style={{ color: n <= filled ? GOLD : STAR_EMPTY }}
          >
            {STAR}
          </span>
        ))}
      </span>
      <span
        className="mono tab-num text-[12px]"
        style={{ color: "var(--spark-text)" }}
      >
        {avgRating.toFixed(1)}
      </span>
      <span
        className="mono tab-num text-[11px]"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        ({ratingsCount})
      </span>
    </span>
  );
};

/* ───────────────────────── leaderboard row ───────────────────────── */

const LeaderboardRow: React.FC<{
  rank: number;
  entry: Entry;
  showReliability: boolean;
  isFirst: boolean;
}> = ({ rank, entry, showReliability, isFirst }) => (
  <li
    className="flex items-center gap-3 py-2.5"
    style={
      isFirst
        ? undefined
        : { borderTop: "1px solid rgba(255,255,255,0.06)" }
    }
  >
    {/* Rank — fixed-width tab-num so the column stays aligned 1→10. */}
    <span
      className="mono tab-num text-[12px] shrink-0 text-right"
      style={{ width: "1.6rem", color: "rgba(255,255,255,0.45)" }}
    >
      {rank}
    </span>

    {/* Name + the small muted shift/recap (and optional reliability) stats. */}
    <div className="min-w-0 flex-1">
      <p
        className="text-[14px] font-medium truncate"
        style={{ color: "var(--spark-text)" }}
      >
        {entry.name}
      </p>
      <p
        className="mono text-[11px] mt-0.5"
        style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}
      >
        <span className="tab-num">{entry.shiftsWorked}</span>
        {entry.shiftsWorked === 1 ? " shift" : " shifts"}
        <span aria-hidden="true" className="mx-1.5">
          ·
        </span>
        <span className="tab-num">{entry.recapsFiled}</span>
        {entry.recapsFiled === 1 ? " recap" : " recaps"}
        {showReliability && entry.reliabilityPct != null && (
          <>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span className="tab-num">{entry.reliabilityPct}%</span> on-time
          </>
        )}
      </p>
    </div>

    {/* Rating, right-aligned so the eye scans a clean rating column. */}
    <div className="shrink-0 text-right">
      <RatingCell avgRating={entry.avgRating} ratingsCount={entry.ratingsCount} />
    </div>
  </li>
);

/* ───────────────────────── card ───────────────────────── */

const TenantBaLeaderboard: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<TenantBaLeaderboardQueryType>(
    TenantBaLeaderboardQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const items = useMemo(
    () => data?.tenantBaLeaderboard ?? [],
    [data],
  );

  // Future-proof: reliability is always null today, so only surface the stat
  // once the backend actually populates it for at least one BA.
  const showReliability = useMemo(
    () => items.some((i) => i.reliabilityPct != null),
    [items],
  );

  const visible = items.slice(0, VISIBLE_LIMIT);
  const overflow = items.length - visible.length;

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Top performers
        </h2>
        {items.length > 0 && (
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            BA LEADERBOARD · BY RATING
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p
          className="text-sm py-10 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No BA performance data yet.
        </p>
      ) : (
        <>
          {/* Height-bounded so a long roster scrolls inside the card instead of
              stretching the dashboard; short lists just size to content. */}
          <ul
            className="overflow-y-auto pr-1"
            style={{ maxHeight: 360 }}
          >
            {visible.map((entry, i) => (
              <LeaderboardRow
                key={entry.baId}
                rank={i + 1}
                entry={entry}
                showReliability={showReliability}
                isFirst={i === 0}
              />
            ))}
          </ul>
          {overflow > 0 && (
            <p
              className="mono text-[11px] mt-3 text-center"
              style={{ letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)" }}
            >
              +{overflow} more
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default TenantBaLeaderboard;
