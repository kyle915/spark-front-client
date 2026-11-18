/**
 * Shaping for "What consumers mention": themes and other brands by month.
 * Pure functions over plain rows, unit-tested without a component or a
 * generated Relay file. Nothing here changes a count: every number comes
 * from the server and is recaps.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const count = (n: number): string => n.toLocaleString("en-US");

/** "2026-10" → "October" (or "Oct" when short). Anything else is returned as is. */
export function monthName(key: string | null | undefined, short = false): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!match) return key ?? "";
  const name = MONTHS[Number(match[2]) - 1];
  if (!name) return key ?? "";
  return short ? name.slice(0, 3) : name;
}

export type SeriesRow = {
  key: string;
  label: string;
  polarity?: string;
  counts: readonly number[];
  total: number;
  current: number;
  previous: number;
  currentShare: number;
  previousShare: number;
  direction: string;
  quote?: string;
};

export type Trends = {
  months: readonly string[];
  recapCounts: readonly number[];
  compareMonth: string | null | undefined;
  priorMonth: string | null | undefined;
};

/** Share of a month's recaps, 0–100, rounded. */
export const share = (value: number, base: number): number =>
  base > 0 ? Math.round((100 * value) / base) : 0;

export type Column = {
  month: string;
  /** Recaps that mention it this month. */
  value: number;
  /** Recaps read this month. */
  base: number;
  share: number;
  /** 0–1 against the tallest share in the whole group, so rows compare. */
  height: number;
  /** The month the trend is read from. */
  compared: boolean;
  tooltip: string;
};

/** The tallest share across a group of rows: one scale for every small multiple. */
export function groupMaxShare(rows: readonly SeriesRow[], trends: Trends): number {
  let max = 0;
  for (const row of rows) {
    row.counts.forEach((value, i) => {
      max = Math.max(max, share(value, trends.recapCounts[i] ?? 0));
    });
  }
  return max;
}

/** One small-multiple row's columns, on the group's shared scale. */
export function columns(row: SeriesRow, trends: Trends, maxShare: number): Column[] {
  return trends.months.map((month, i) => {
    const value = row.counts[i] ?? 0;
    const base = trends.recapCounts[i] ?? 0;
    const pct = share(value, base);
    return {
      month,
      value,
      base,
      share: pct,
      height: maxShare > 0 ? pct / maxShare : 0,
      compared: month === trends.compareMonth,
      tooltip:
        base > 0
          ? `${monthName(month)}: ${count(value)} of ${count(base)} recaps (${pct}%)`
          : `${monthName(month)}: no recaps read`,
    };
  });
}

/** "↑ Rising", "↓ Falling", "Steady", or nothing when there is too little to say. */
export function directionWord(direction: string): string {
  if (direction === "rising") return "↑ Rising";
  if (direction === "falling") return "↓ Falling";
  if (direction === "steady") return "Steady";
  return "";
}

/** "5 of 9 recaps (56%) in October, from 1 of 6 (17%) in September". */
export function changeWords(row: SeriesRow, trends: Trends): string {
  const now = trends.compareMonth;
  const before = trends.priorMonth;
  if (!now || !before) return `${count(row.total)} ${row.total === 1 ? "recap" : "recaps"} in these months`;
  const i = trends.months.indexOf(now);
  const j = trends.months.indexOf(before);
  const base = trends.recapCounts[i] ?? 0;
  const prior = trends.recapCounts[j] ?? 0;
  return (
    `${count(row.current)} of ${count(base)} recaps (${share(row.current, base)}%) in ${monthName(now)}, ` +
    `from ${count(row.previous)} of ${count(prior)} (${share(row.previous, prior)}%) in ${monthName(before)}`
  );
}

const POLARITY: Record<string, string> = {
  praise: "Praise",
  complaint: "Complaint",
  request: "Request",
};

export const polarityWord = (polarity: string | undefined): string =>
  POLARITY[polarity ?? ""] ?? "";

/** The line under the title: what is counted and what it takes to call a trend. */
export function trendsBasis(trends: Trends, minMonthRecaps: number, minMentions: number): string {
  const read = trends.recapCounts.reduce((sum, n) => sum + n, 0);
  const first = monthName(trends.months[0]);
  const last = monthName(trends.months[trends.months.length - 1]);
  const compare =
    trends.compareMonth && trends.priorMonth
      ? ` Rising and falling compare ${monthName(trends.compareMonth)} with ${monthName(trends.priorMonth)} by share of recaps.`
      : ` A trend needs ${minMonthRecaps} or more recaps in each of two months in a row, so none is called yet.`;
  return (
    `${count(read)} approved ${read === 1 ? "recap" : "recaps"} with consumer comments, ${first} to ${last}, by event month. ` +
    `Each count is recaps, not comments.${compare} A trend also needs ${minMentions} or more recaps mentioning it.`
  );
}
