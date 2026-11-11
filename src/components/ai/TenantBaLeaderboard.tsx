import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { TenantBaLeaderboardQuery } from "@/api/queries/TenantBaLeaderboardQuery";
import type { TenantBaLeaderboardQuery as TenantBaLeaderboardQueryType } from "@api/queries/__generated__/TenantBaLeaderboardQuery.graphql";

/**
 * "Top performers" BA leaderboard. Range-scoped when start/end are passed.
 * Shows consumers/samples when available; hides reliabilityPct until filled.
 * Row click → /recaps/list filtered by BA name (via location state).
 */

const VISIBLE_LIMIT = 10;

const STAR = "★";
const GOLD = "var(--spark-gold)";
const STAR_EMPTY = "rgba(var(--spark-ink-rgb),0.18)";

type Entry =
  TenantBaLeaderboardQueryType["response"]["tenantBaLeaderboard"][number];

const RatingCell: React.FC<{
  avgRating: number | null | undefined;
  ratingsCount: number;
}> = ({ avgRating, ratingsCount }) => {
  if (avgRating == null) {
    return (
      <span
        className="text-[13px]"
        style={{ color: "var(--spark-text-meta)" }}
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
        style={{ color: "var(--spark-text-meta)" }}
      >
        ({ratingsCount})
      </span>
    </span>
  );
};

const LeaderboardRow: React.FC<{
  rank: number;
  entry: Entry;
  showReliability: boolean;
  showReach: boolean;
  isFirst: boolean;
  onClick: () => void;
}> = ({ rank, entry, showReliability, showReach, isFirst, onClick }) => (
  <li
    className="flex items-center gap-3 py-2.5 cursor-pointer"
    style={
      isFirst
        ? undefined
        : { borderTop: "1px solid rgba(var(--spark-ink-rgb),0.06)" }
    }
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    role="button"
    tabIndex={0}
    title={`Open recaps for ${entry.name}`}
  >
    <span
      className="mono tab-num text-[12px] shrink-0 text-right"
      style={{ width: "1.6rem", color: "var(--spark-text-meta)" }}
    >
      {rank}
    </span>

    <div className="min-w-0 flex-1">
      <p
        className="text-[14px] font-medium truncate"
        style={{ color: "var(--spark-text)" }}
      >
        {entry.name}
      </p>
      <p
        className="mono text-[11px] mt-0.5"
        style={{ color: "var(--spark-text-meta)", letterSpacing: "0.02em" }}
      >
        <span className="tab-num">{entry.shiftsWorked}</span>
        {entry.shiftsWorked === 1 ? " shift" : " shifts"}
        <span aria-hidden="true" className="mx-1.5">
          ·
        </span>
        <span className="tab-num">{entry.recapsFiled}</span>
        {entry.recapsFiled === 1 ? " recap" : " recaps"}
        {showReach && (entry.consumersReached > 0 || entry.samplesDistributed > 0) && (
          <>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span className="tab-num">{entry.consumersReached.toLocaleString()}</span>{" "}
            consumers
            {entry.samplesDistributed > 0 &&
              entry.samplesDistributed !== entry.consumersReached && (
                <>
                  <span aria-hidden="true" className="mx-1.5">
                    ·
                  </span>
                  <span className="tab-num">
                    {entry.samplesDistributed.toLocaleString()}
                  </span>{" "}
                  samples
                </>
              )}
          </>
        )}
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

    <div className="shrink-0 text-right">
      <RatingCell avgRating={entry.avgRating} ratingsCount={entry.ratingsCount} />
    </div>
  </li>
);

const TenantBaLeaderboard: React.FC<{
  tenantId: string;
  startDate?: string | null;
  endDate?: string | null;
  rangeLabel?: string;
}> = ({ tenantId, startDate = null, endDate = null, rangeLabel }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<TenantBaLeaderboardQueryType>(
    TenantBaLeaderboardQuery,
    {
      tenantId,
      startDate: startDate || null,
      endDate: endDate || null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const items = useMemo(
    () => data?.tenantBaLeaderboard ?? [],
    [data],
  );

  const showReliability = useMemo(
    () => items.some((i) => i.reliabilityPct != null),
    [items],
  );
  const showReach = useMemo(
    () =>
      items.some(
        (i) => (i.consumersReached ?? 0) > 0 || (i.samplesDistributed ?? 0) > 0,
      ),
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
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            BA LEADERBOARD
            {rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ""}
            {showReach ? " · BY REACH" : " · BY RATING"}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p
          className="text-sm py-10 text-center"
          style={{ color: "var(--spark-text-meta)" }}
        >
          No BA performance data yet.
        </p>
      ) : (
        <>
          <ul className="overflow-y-auto pr-1" style={{ maxHeight: 360 }}>
            {visible.map((entry, i) => (
              <LeaderboardRow
                key={entry.baId}
                rank={i + 1}
                entry={entry}
                showReliability={showReliability}
                showReach={showReach}
                isFirst={i === 0}
                onClick={() =>
                  navigate("/recaps/list", {
                    state: { baName: entry.name },
                  })
                }
              />
            ))}
          </ul>
          {overflow > 0 && (
            <p
              className="mono text-[11px] mt-3 text-center"
              style={{ letterSpacing: "0.06em", color: "var(--spark-text-meta)" }}
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
