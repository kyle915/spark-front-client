/**
 * Shaping for the "consumers sampled" charts: the weekly trend and the
 * ranked splits by store, state and product. Pure functions over plain
 * rows, so they are unit-tested without a component or a generated Relay
 * file. Nothing here changes a number: it only decides what is drawn as a
 * bar, what is folded, and how a row with nothing recorded is named.
 */
import { foldToOther } from "@/lib/sparkChart";

export type SplitRow = {
  label: string;
  /** "named" a real store / state, "other" a folded tail, "missing" nothing recorded. */
  kind: string;
  consumers: number;
};

export type RankedBar = {
  label: string;
  value: number;
  /** Drawn quiet: context, not a ranked item. */
  context: boolean;
};

export type RankedSplit = {
  bars: RankedBar[];
  /** What the bars add up to, plus `aside`: always the split's whole total. */
  total: number;
  /** How many named rows exist in all (the bars show the largest few). */
  namedCount: number;
  /**
   * The folded tail when it is too large to draw beside the rows it would
   * dwarf. Said in words under the chart instead of as a bar.
   */
  aside: { count: number | null; value: number } | null;
};

/** Named rows shown before the tail is folded: 6 keeps the list short enough to print every value. */
export const TOP_ROWS = 6;

/** A folded tail this many times the top row is said in words, not drawn. */
const OTHER_BAR_LIMIT = 1.5;

/**
 * A ranked list: the largest `keep` named rows, then "Other", then the
 * rows with nothing recorded under `missingLabel`, which is always last
 * and never the top bar however large it is.
 */
export function rankedSplit(
  rows: readonly SplitRow[],
  opts: { missingLabel: string; keep?: number; namedCount?: number },
): RankedSplit {
  const keep = opts.keep ?? TOP_ROWS;
  const sum = (list: readonly SplitRow[]) => list.reduce((s, r) => s + r.consumers, 0);
  const named = rows.filter((r) => r.kind === "named" && r.consumers > 0);
  const missing = sum(rows.filter((r) => r.kind === "missing"));
  const alreadyFolded = sum(rows.filter((r) => r.kind === "other"));
  const namedCount = Math.max(opts.namedCount ?? 0, named.length);

  const folded = foldToOther(
    named.map((r) => ({ label: r.label, value: r.consumers })),
    keep,
  );
  const head = folded.slice(0, Math.min(keep, named.length));
  const tail = folded.slice(head.length).reduce((s, r) => s + r.value, 0) + alreadyFolded;
  // A tail the server already folded hides how many rows are in it unless
  // the caller knows the full count.
  const tailCount =
    alreadyFolded > 0 && opts.namedCount === undefined
      ? null
      : Math.max(0, namedCount - head.length);

  const bars: RankedBar[] = head.map((r) => ({ ...r, context: false }));
  const top = head[0]?.value ?? 0;
  const drawTail = tail > 0 && tail <= top * OTHER_BAR_LIMIT;
  if (drawTail) bars.push({ label: "Other", value: tail, context: true });
  if (missing > 0) bars.push({ label: opts.missingLabel, value: missing, context: true });

  return {
    bars,
    total: sum(rows),
    namedCount,
    aside: tail > 0 && !drawTail ? { count: tailCount, value: tail } : null,
  };
}

/**
 * A row name short enough for a chart's label column (about 18 characters
 * at 12px before the axis clips it). The cut is marked with an ellipsis.
 */
export function shortLabel(label: string, max = 18): string {
  const clean = label.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[\s—–\-·,]+$/, "")}…`;
}

/** Indexes of the context bars, for `barSeries({ quiet })`. */
export const contextIndexes = (bars: readonly RankedBar[]): number[] =>
  bars.flatMap((b, i) => (b.context ? [i] : []));

const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** The Monday of `d`'s week, as a local date. */
export const mondayOf = (d: Date): Date => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

/** The last `weeks` Monday-to-Sunday weeks, ending with the one `today` is in. */
export function lastWeeksWindow(
  weeks: number,
  today: Date = new Date(),
): { startDate: string; endDate: string } {
  const start = mondayOf(today);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  return { startDate: ymd(start), endDate: ymd(today) };
}

/**
 * Labels and values for the weekly trend. A week is named by the day it
 * starts ("Oct 5"); the week still in progress is named "This week" so its
 * lower figure does not read as a drop.
 */
export function weeklyTrend(
  weeks: ReadonlyArray<{ weekStart: string; consumers: number }>,
  today: Date = new Date(),
): { labels: string[]; values: number[]; hasData: boolean } {
  const current = ymd(mondayOf(today));
  const labels = weeks.map((w) => {
    if (w.weekStart === current) return "This week";
    const [y, m, d] = w.weekStart.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  });
  const values = weeks.map((w) => w.consumers);
  return { labels, values, hasData: values.some((v) => v > 0) };
}

/**
 * "62% of 1,240 asked": a rate with the number of consumers it is out of.
 * Returns null for the words when the base is unknown, so the caller prints
 * the rate alone rather than an invented base.
 */
export function ofAsked(
  rate: number | null | undefined,
  base: number | null | undefined,
): { rate: string; asked: string | null } | null {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  const shown = `${Math.round(rate)}%`;
  if (typeof base !== "number" || !Number.isFinite(base) || base <= 0) {
    return { rate: shown, asked: null };
  }
  return { rate: shown, asked: `of ${Math.round(base).toLocaleString("en-US")} asked` };
}

/**
 * The top products by samples handed out, with whatever the listed
 * products leave of the total folded into "Other".
 */
export function productSplit(
  items: ReadonlyArray<{ product: string; samples: number }>,
  totalSamples: number,
  keep: number = TOP_ROWS,
): RankedSplit {
  const listed = items.reduce((s, i) => s + i.samples, 0);
  // Products arrive as "Type — Name". The name alone is the label when it
  // still tells every product apart, so the type does not crowd it out.
  const bare = items.map((i) => i.product.split(" — ").slice(1).join(" — ").trim());
  const useBare = bare.every(Boolean) && new Set(bare).size === bare.length;
  const rows: SplitRow[] = items.map((i, n) => ({
    label: useBare ? bare[n] : i.product,
    kind: "named",
    consumers: i.samples,
  }));
  const beyond = Math.max(0, totalSamples - listed);
  if (beyond > 0) rows.push({ label: "", kind: "other", consumers: beyond });
  // How many products sit behind "Other" is not known from a top-N list.
  return rankedSplit(rows, { missingLabel: "", keep });
}

/** Whether a paged list came back short of everything that matches. */
export const isCutOff = (shown: number, total: number | null | undefined): boolean =>
  typeof total === "number" && total > shown;

/**
 * Consumers sampled per event, or null when there is nothing to divide.
 * One decimal under ten, whole numbers above.
 */
export function perEvent(total: number, events: number): number | null {
  if (!(events > 0) || !(total > 0)) return null;
  const each = total / events;
  return each < 10 ? Math.round(each * 10) / 10 : Math.round(each);
}
