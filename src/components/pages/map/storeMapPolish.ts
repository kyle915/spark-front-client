export interface CoverageInput {
  all: number;
  sampled: number;
  repeat: number;
  planned: number;
  neverVisited: number;
}

export interface AccountCoverageSummary {
  totalStores: number;
  visitedCount: number;
  visitedPct: number;
  repeatCount: number;
  plannedCount: number;
  neverVisitedCount: number;
  headline: string;
}

/** Compute % of target stores with >= 1 filed recap (sampled + repeat). */
export function computeAccountCoverageSummary(
  counts: CoverageInput,
): AccountCoverageSummary {
  const totalStores = Math.max(0, counts.all);
  const visitedCount = Math.max(0, counts.sampled + counts.repeat);
  const visitedPct =
    totalStores > 0
      ? Math.min(100, Math.round((visitedCount / totalStores) * 100))
      : 0;
  const headline =
    totalStores === 0
      ? "0% sampled"
      : `${visitedPct}% sampled (${visitedCount.toLocaleString("en-US")} of ${totalStores.toLocaleString("en-US")})`;

  return {
    totalStores,
    visitedCount,
    visitedPct,
    repeatCount: Math.max(0, counts.repeat),
    plannedCount: Math.max(0, counts.planned),
    neverVisitedCount: Math.max(0, counts.neverVisited),
    headline,
  };
}

export interface WaveStoreSummaryItem {
  market?: string | null;
  state?: string | null;
}

export interface WaveIslandSummary {
  storeCount: number;
  marketCount: number;
  stateCount: number;
  topMarkets: string[];
  overflowMarkets: number;
  summaryLabel: string;
}

/** Summarize checked stores for the floating Account Map Wave Builder Island. */
export function summarizeWaveIsland(
  stores: ReadonlyArray<WaveStoreSummaryItem>,
  maxMarketPills = 3,
): WaveIslandSummary {
  const storeCount = stores.length;
  const marketTallies = new Map<string, { label: string; count: number }>();
  const states = new Set<string>();

  for (const s of stores) {
    const st = (s.state || "").trim().toUpperCase();
    if (st) states.add(st);
    const rawMarket = (s.market || st || "").trim();
    if (rawMarket) {
      const key = rawMarket.toLowerCase();
      const prev = marketTallies.get(key);
      if (prev) prev.count += 1;
      else marketTallies.set(key, { label: rawMarket, count: 1 });
    }
  }

  const orderedMarkets = [...marketTallies.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((m) => m.label);

  const marketCount = orderedMarkets.length;
  const topMarkets = orderedMarkets.slice(0, maxMarketPills);
  const overflowMarkets = Math.max(0, marketCount - topMarkets.length);

  const parts = [
    `${storeCount.toLocaleString("en-US")} ${storeCount === 1 ? "store" : "stores"}`,
  ];
  if (marketCount > 0) {
    parts.push(
      `${marketCount.toLocaleString("en-US")} ${marketCount === 1 ? "market" : "markets"}`,
    );
  } else if (states.size > 0) {
    parts.push(
      `${states.size.toLocaleString("en-US")} ${states.size === 1 ? "state" : "states"}`,
    );
  }

  return {
    storeCount,
    marketCount,
    stateCount: states.size,
    topMarkets,
    overflowMarkets,
    summaryLabel: parts.join(" · "),
  };
}
