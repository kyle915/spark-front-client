import { requestDateKey } from "@/lib/requestDateKey";

export type UpcomingRetailerInput = {
  date: string | null | undefined;
  retailerName: string | null | undefined;
};

export type RankedRetailer = {
  key: string;
  name: string;
  count: number;
  /** Missing-name remainder. Not a ranked store. */
  quiet?: boolean;
};

const PLACEHOLDER_NAMES = new Set(["—", "–", "-", "−"]);

/** Trim + case key for a real store name. Blank and dash placeholders are not stores. */
function retailerRankKey(name: string | null | undefined): string | null {
  if (name == null) return null;
  const trimmed = name.trim();
  if (!trimmed || PLACEHOLDER_NAMES.has(trimmed)) return null;
  return trimmed.toLowerCase();
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Same window as the week-ahead bars: today inclusive, today+horizonDays exclusive. */
export function isRequestInHorizon(
  date: string | null | undefined,
  today: Date,
  horizonDays: number,
): boolean {
  const key = requestDateKey(date);
  if (!key) return false;
  const [y, mo, d] = key.split("-").map(Number);
  const ms = new Date(y, mo - 1, d).getTime();
  if (!Number.isFinite(ms)) return false;
  const start = startOfLocalDay(today);
  const endExclusive = new Date(start);
  endExclusive.setDate(start.getDate() + horizonDays);
  return ms >= start.getTime() && ms < endExclusive.getTime();
}

function preferredLabel(labels: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [label, count] of labels) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Rank upcoming requests by retailer for the client-dashboard card.
 * Counts requests in the horizon (not filed recaps). Null, blank, and
 * dash names stay out of the ranking so they cannot become the top row.
 * A small unassigned remainder is appended after named stores. Names
 * merge only on trim and case.
 */
export function rankUpcomingRetailers(
  rows: readonly UpcomingRetailerInput[],
  options: { today: Date; horizonDays: number; limit?: number },
): RankedRetailer[] {
  const limit = options.limit ?? 5;
  const buckets = new Map<
    string,
    { count: number; labels: Map<string, number> }
  >();
  let unassigned = 0;

  for (const row of rows) {
    if (!isRequestInHorizon(row.date, options.today, options.horizonDays)) {
      continue;
    }
    const key = retailerRankKey(row.retailerName);
    if (!key) {
      unassigned += 1;
      continue;
    }
    const trimmed = (row.retailerName ?? "").trim();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, labels: new Map() };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.labels.set(trimmed, (bucket.labels.get(trimmed) ?? 0) + 1);
  }

  const named: RankedRetailer[] = [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      name: preferredLabel(bucket.labels),
      count: bucket.count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit));

  const floor = named.length > 0 ? named[named.length - 1].count : 0;
  if (unassigned > 0 && named.length > 0 && unassigned < floor) {
    named.push({
      key: "unassigned",
      name: "Unassigned",
      count: unassigned,
      quiet: true,
    });
  }

  return named;
}
