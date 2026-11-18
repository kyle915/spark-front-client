import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantMentionTrendsQuery } from "@/api/queries/TenantMentionTrendsQuery";
import type { TenantMentionTrendsQuery as TrendsQueryType } from "@api/queries/__generated__/TenantMentionTrendsQuery.graphql";
import {
  changeWords,
  columns,
  directionWord,
  groupMaxShare,
  monthName,
  polarityWord,
  trendsBasis,
  type SeriesRow,
  type Trends,
} from "@/lib/mentionTrends";

const TEXT = { color: "var(--spark-text)" } as const;
const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const RULE = { borderColor: "var(--spark-border)" } as const;

/* One hue: ink for the compared month, a lighter step of the same ink for
   the other months. Both are the page's own tokens, so dark mode is its own
   step rather than a flip. */
const MARK = "var(--spark-text)";
const MARK_QUIET = "rgba(var(--spark-ink-rgb), 0.24)";

const TITLE = "What consumers mention";
const SPARK_W = 132;
const SPARK_H = 32;

type Props = { tenantId: string; endDate?: string };

const Heading: React.FC = () => (
  <h3 className="display font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
    {TITLE}
  </h3>
);

const Quiet: React.FC<{ children: ReactNode }> = ({ children }) => (
  <section aria-label={TITLE}>
    <Heading />
    <p className="text-sm py-2" style={META}>
      {children}
    </p>
  </section>
);

/** Thin monthly columns on the group's shared scale, with a tooltip per column. */
const Spark: React.FC<{ row: SeriesRow; trends: Trends; maxShare: number }> = ({
  row,
  trends,
  maxShare,
}) => {
  const cols = columns(row, trends, maxShare);
  const [active, setActive] = useState<number | null>(null);
  const slot = SPARK_W / Math.max(1, cols.length);
  const bar = Math.min(12, Math.max(4, slot - 6));
  const tip = active !== null ? cols[active] : null;
  return (
    <div className="relative shrink-0" style={{ width: SPARK_W }}>
      <svg
        width={SPARK_W}
        height={SPARK_H + 2}
        role="img"
        aria-label={`${row.label} by month: ${cols.map((c) => c.tooltip).join("; ")}`}
        onMouseLeave={() => setActive(null)}
      >
        {/* Baseline hairline */}
        <line
          x1={0}
          x2={SPARK_W}
          y1={SPARK_H + 1}
          y2={SPARK_H + 1}
          stroke="rgba(var(--spark-ink-rgb), 0.12)"
          strokeWidth={1}
        />
        {cols.map((c, i) => {
          const h = c.value > 0 ? Math.max(2, c.height * SPARK_H) : 0;
          const x = i * slot + (slot - bar) / 2;
          return (
            <g key={c.month}>
              {h > 0 ? (
                <path
                  d={roundedTop(x, SPARK_H - h, bar, h, Math.min(2, bar / 2))}
                  fill={c.compared ? MARK : MARK_QUIET}
                  opacity={active === null || active === i ? 1 : 0.6}
                />
              ) : null}
              {/* The hit target is the whole slot, not the painted bar. */}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={SPARK_H + 2}
                fill="transparent"
                tabIndex={0}
                aria-label={c.tooltip}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ outline: "none", cursor: "default" }}
              />
            </g>
          );
        })}
      </svg>
      {tip ? (
        <div
          role="tooltip"
          className="absolute z-10 whitespace-nowrap rounded-md px-2 py-1 text-xs pointer-events-none"
          style={{
            bottom: SPARK_H + 8,
            left: Math.min(Math.max(0, (active ?? 0) * slot - 40), SPARK_W - 120),
            background: "var(--spark-surface-2)",
            border: "1px solid var(--spark-border)",
            boxShadow: "var(--spark-elev-1)",
          }}
        >
          <span className="font-semibold" style={TEXT}>
            {tip.value} of {tip.base}
          </span>
          <span style={META}>
            {" "}
            · {monthName(tip.month)} · {tip.share}%
          </span>
        </div>
      ) : null}
    </div>
  );
};

/** A bar with a 2px rounded data end, anchored square on the baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h);
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

const Row: React.FC<{
  row: SeriesRow;
  trends: Trends;
  maxShare: number;
  showQuote: boolean;
}> = ({ row, trends, maxShare, showQuote }) => {
  const word = directionWord(row.direction);
  const tone = polarityWord(row.polarity);
  return (
    <li
      className="grid gap-x-5 gap-y-1 py-3 border-b items-start md:[grid-template-columns:minmax(0,1fr)_132px_13rem]"
      style={RULE}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium break-words" style={TEXT}>
          {row.label}
          {tone ? (
            <span className="font-normal" style={META}>
              {" · "}
              {tone}
            </span>
          ) : null}
        </p>
        {showQuote && row.quote ? (
          <p className="text-sm mt-0.5 break-words" style={SECONDARY}>
            “{row.quote}”
          </p>
        ) : null}
      </div>
      <Spark row={row} trends={trends} maxShare={maxShare} />
      <div className="text-xs md:text-right">
        {word ? (
          <p className="text-sm font-medium" style={TEXT}>
            {word}
          </p>
        ) : null}
        <p style={META}>{changeWords(row, trends)}</p>
      </div>
    </li>
  );
};

const Group: React.FC<{
  title: string;
  rows: readonly SeriesRow[];
  trends: Trends;
  showQuote: boolean;
  empty: string;
}> = ({ title, rows, trends, showQuote, empty }) => {
  const maxShare = useMemo(() => groupMaxShare(rows, trends), [rows, trends]);
  return (
    <div>
      <h4 className="text-[13px] font-medium pb-1 border-b" style={{ ...SECONDARY, ...RULE }}>
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-sm py-3" style={META}>
          {empty}
        </p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {rows.map((row) => (
            <Row key={row.key} row={row} trends={trends} maxShare={maxShare} showQuote={showQuote} />
          ))}
        </ul>
      )}
    </div>
  );
};

/** Legend for the one-hue columns. */
const Legend: React.FC<{ trends: Trends }> = ({ trends }) => (
  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={META}>
    {trends.compareMonth ? (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block w-2 h-3 rounded-t-sm" style={{ background: MARK }} />
        {monthName(trends.compareMonth)} (compared month)
      </span>
    ) : null}
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block w-2 h-3 rounded-t-sm" style={{ background: MARK_QUIET }} />
      {trends.compareMonth ? "Other months" : "Each month"}
    </span>
    <span>Column height is share of that month's recaps, on one scale per list.</span>
  </p>
);

/** Every number on the card as a table, for anyone who cannot use the columns. */
const NumbersTable: React.FC<{ rows: readonly SeriesRow[]; trends: Trends }> = ({ rows, trends }) => (
  <details className="text-xs" style={META}>
    <summary className="cursor-pointer select-none">Show the numbers</summary>
    <div className="overflow-x-auto mt-2">
      <table className="text-xs border-collapse">
        <thead>
          <tr style={SECONDARY}>
            <th scope="col" className="text-left font-medium pr-4 pb-1">
              Mentioned
            </th>
            {trends.months.map((m) => (
              <th key={m} scope="col" className="text-right font-medium px-2 pb-1">
                {monthName(m, true)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="text-left font-normal pr-4 py-0.5">
              Recaps read
            </th>
            {trends.recapCounts.map((n, i) => (
              <td key={trends.months[i]} className="text-right px-2 tabular-nums">
                {n}
              </td>
            ))}
          </tr>
          {rows.map((row) => (
            <tr key={row.key} style={TEXT}>
              <th scope="row" className="text-left font-normal pr-4 py-0.5">
                {row.label}
              </th>
              {row.counts.map((n, i) => (
                <td key={trends.months[i]} className="text-right px-2 tabular-nums">
                  {n}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

type Result = TrendsQueryType["response"]["tenantMentionTrends"];

/** The card from a loaded result. Exported so it can be shown with fixtures. */
export const MentionTrendsView: React.FC<{ result: Result }> = ({ result }) => {
  const trends: Trends = useMemo(
    () => ({
      months: result.months,
      recapCounts: result.recapCounts,
      compareMonth: result.compareMonth,
      priorMonth: result.priorMonth,
    }),
    [result],
  );

  if (result.status === "not_tagged") {
    return (
      <Quiet>
        Consumer comments have not been read for this yet. This fills in after the next nightly
        run.
      </Quiet>
    );
  }
  if (result.status === "too_few") {
    return (
      <Quiet>
        Too few approved recaps with consumer comments in the last six months to show what comes
        up.
      </Quiet>
    );
  }
  if (result.status !== "ready") {
    return <Quiet>This is not available right now.</Quiet>;
  }

  return (
    <section aria-label={TITLE} className="flex flex-col gap-5">
      <div>
        <Heading />
        <p className="text-xs" style={META}>
          {trendsBasis(trends, result.minMonthRecaps, result.minTrendMentions)}
        </p>
      </div>

      {result.headlines.length > 0 ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-1">
          {result.headlines.map((line) => (
            <li key={line} className="text-sm" style={TEXT}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      <Legend trends={trends} />

      <div className="grid gap-8">
        <Group
          title="Themes"
          rows={result.themes}
          trends={trends}
          showQuote
          empty="No theme came up on more than one recap."
        />
        <Group
          title="Other brands named"
          rows={result.brands}
          trends={trends}
          showQuote={false}
          empty="No other brand came up on more than one recap."
        />
      </div>

      <NumbersTable rows={[...result.themes, ...result.brands]} trends={trends} />
    </section>
  );
};

const Inner: React.FC<Props> = ({ tenantId, endDate }) => {
  const data = useLazyLoadQuery<TrendsQueryType>(
    TenantMentionTrendsQuery,
    { tenantId, endDate: endDate ?? null, months: 6 },
    { fetchPolicy: "store-or-network" },
  );
  return <MentionTrendsView result={data.tenantMentionTrends} />;
};

/**
 * What consumers mention, month over month: the brand's themes and the other
 * brands people name, each as a row of thin monthly columns on one shared
 * scale, with rising or falling called only past the server's floors. A
 * failed or slow load shows one sentence and leaves the rest of the page
 * alone.
 */
const MentionTrends: React.FC<Props> = (props) => (
  <ErrorBoundary
    key={`${props.tenantId}|${props.endDate ?? ""}`}
    fallback={<Quiet>This section could not load.</Quiet>}
  >
    <Suspense
      fallback={
        <Quiet>
          <span className="sr-only">Loading</span>
        </Quiet>
      }
    >
      <Inner {...props} />
    </Suspense>
  </ErrorBoundary>
);

export default MentionTrends;
