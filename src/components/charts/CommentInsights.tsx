import { Suspense, useMemo, type ReactNode } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Bar } from "react-chartjs-2";
import "@/lib/sparkChartRegister";
import ChartBlock from "@/components/charts/ChartBlock";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantCompetitorMentionsQuery } from "@/api/queries/TenantCompetitorMentionsQuery";
import type { TenantCompetitorMentionsQuery as MentionsQueryType } from "@api/queries/__generated__/TenantCompetitorMentionsQuery.graphql";
import { TenantProductRegionsQuery } from "@/api/queries/TenantProductRegionsQuery";
import type { TenantProductRegionsQuery as RegionsQueryType } from "@api/queries/__generated__/TenantProductRegionsQuery.graphql";
import { shortLabel } from "@/lib/consumerBreakdown";
import {
  brandBars,
  mentionsBasis,
  moreBrands,
  regionCell,
  regionColumns,
  regionsBasis,
  stanceWords,
  topBrands,
} from "@/lib/commentInsights";
import { barSeries, chartOptions, valueLabels } from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";

const everyValue = valueLabels("all");

const TEXT = { color: "var(--spark-text)" } as const;
const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const RULE = { borderColor: "var(--spark-border)" } as const;

const BRANDS_TITLE = "Other brands people mentioned";
const BRANDS_CHART_TITLE = "Recaps that mention each brand";
const REGIONS_TITLE = "What sells where";
const ROW_HEIGHT = 34;

type Window = { tenantId: string; startDate: string; endDate: string };

const Heading: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="display font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
    {title}
  </h3>
);

/** The heading and one short sentence, when there is nothing to draw. */
const Quiet: React.FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section aria-label={title}>
    <Heading title={title} />
    <p className="text-sm py-2" style={META}>
      {children}
    </p>
  </section>
);

/** Keeps one section's failed or slow query from taking the page with it. */
const Guard: React.FC<Window & { title: string; children: ReactNode }> = ({
  title,
  children,
  tenantId,
  startDate,
  endDate,
}) => (
  // Keyed on the window so a failed load does not stick after the dates change.
  <ErrorBoundary
    key={`${tenantId}|${startDate}|${endDate}`}
    fallback={<Quiet title={title}>This section could not load.</Quiet>}
  >
    <Suspense
      fallback={
        <Quiet title={title}>
          <span className="sr-only">Loading</span>
        </Quiet>
      }
    >
      {children}
    </Suspense>
  </ErrorBoundary>
);

/* ───────────────────── other brands people mentioned ───────────────────── */

const MentionsInner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  useAppearance();
  const data = useLazyLoadQuery<MentionsQueryType>(
    TenantCompetitorMentionsQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const result = data.tenantCompetitorMentions;
  const brands = useMemo(() => topBrands(result.brands), [result]);
  const bars = useMemo(() => brandBars(result.brands), [result]);
  const more = moreBrands(result.brands);

  if (result.status === "too_few") {
    return (
      <Quiet title={BRANDS_TITLE}>
        Too few comments on approved recaps in these dates name another brand to say anything
        about them.
      </Quiet>
    );
  }
  if (result.status !== "ready" || brands.length === 0) {
    return <Quiet title={BRANDS_TITLE}>Other brands are not available right now.</Quiet>;
  }

  return (
    <section aria-label={BRANDS_TITLE} className="flex flex-col gap-5">
      <div>
        <Heading title={BRANDS_TITLE} />
        <p className="text-xs" style={META}>
          {mentionsBasis(
            result.mentionCommentCount,
            result.commentCount,
            result.recapCount,
            result.truncated,
          )}
        </p>
      </div>

      {/* One brand is a sentence in the list below, not a one-bar chart. */}
      {bars.length > 1 ? (
        <ChartBlock title={BRANDS_CHART_TITLE} height={Math.max(96, bars.length * ROW_HEIGHT + 36)}>
          <Bar
            data={{
              labels: bars.map((b) => shortLabel(b.label)),
              datasets: [
                barSeries({ label: "Recaps", data: bars.map((b) => b.value), horizontal: true }),
              ],
            }}
            options={chartOptions<"bar">({ horizontal: true })}
            plugins={[everyValue]}
          />
        </ChartBlock>
      ) : null}

      <ul className="m-0 p-0 list-none grid gap-x-8 gap-y-4 md:grid-cols-2">
        {brands.map((brand) => (
          <li key={brand.brand} className="min-w-0">
            <p className="text-sm font-medium break-words" style={TEXT}>
              {brand.brand}
              <span className="font-normal" style={META}>
                {" · "}
                {stanceWords(brand)}
              </span>
            </p>
            {brand.quote ? (
              <p className="text-sm mt-0.5 break-words" style={SECONDARY}>
                “{brand.quote}”
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {more ? (
        <p className="text-xs" style={META}>
          {more} mentioned less often.
        </p>
      ) : null}
    </section>
  );
};

/**
 * Other brands consumers named in comments on approved recaps: a ranked bar
 * of recaps per brand, then each brand's split in words and one comment as
 * written. A failed or slow load shows one sentence and leaves the rest of
 * the page alone.
 */
export const CompetitorMentions: React.FC<Window> = (props) => (
  <Guard title={BRANDS_TITLE} {...props}>
    <MentionsInner {...props} />
  </Guard>
);

/* ─────────────────────────── what sells where ─────────────────────────── */

const RegionsInner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<RegionsQueryType>(
    TenantProductRegionsQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const result = data.tenantProductRegions;
  const columns = useMemo(
    () => regionColumns(result.hasSold, result.hasSampled, result.commentsStatus),
    [result],
  );

  if (result.status === "unavailable") {
    return <Quiet title={REGIONS_TITLE}>This is not available right now.</Quiet>;
  }
  if (result.status !== "ready" || columns.length === 0 || result.states.length === 0) {
    return (
      <Quiet title={REGIONS_TITLE}>
        Not enough data yet. This fills in once a state has {result.minStateRecaps} or more approved
        recaps, from more than one event, that record sales or samples by product.
      </Quiet>
    );
  }

  // The state, then one column per measure. On a phone each state stacks,
  // with the column's name written above its cell.
  const grid = { gridTemplateColumns: `5rem repeat(${columns.length}, minmax(0, 1fr))` };

  return (
    <section aria-label={REGIONS_TITLE} className="flex flex-col gap-4">
      <div>
        <Heading title={REGIONS_TITLE} />
        <p className="text-xs" style={META}>
          {regionsBasis(result.minStateRecaps, columns)}
          {result.commentsStatus === "unavailable"
            ? " What people said about each product is not available right now."
            : ""}
        </p>
      </div>

      <div role="table" aria-label={REGIONS_TITLE}>
        <div
          role="row"
          className="hidden md:grid gap-x-6 pb-2 border-b text-[13px] font-medium"
          style={{ ...grid, ...SECONDARY, ...RULE }}
        >
          <span role="columnheader">State</span>
          {columns.map((column) => (
            <span role="columnheader" key={column.key}>
              {column.title}
            </span>
          ))}
        </div>
        {result.states.map((state) => (
          <div
            role="row"
            key={state.state}
            className="grid grid-cols-1 gap-y-2 gap-x-6 py-3 border-b md:[grid-template-columns:var(--cols)]"
            style={{ ...RULE, ["--cols" as string]: grid.gridTemplateColumns }}
          >
            <span role="rowheader" className="text-sm font-medium" style={TEXT}>
              {state.state}
            </span>
            {columns.map((column) => {
              const cell = regionCell(state, column.key);
              return (
                <div role="cell" key={column.key} className="min-w-0">
                  <p className="md:hidden text-xs" style={META}>
                    {column.title}
                  </p>
                  <p
                    className={`text-sm break-words ${cell.named ? "font-medium" : ""}`}
                    style={cell.named ? TEXT : META}
                  >
                    {cell.lead}
                  </p>
                  {cell.basis ? (
                    <p className="text-xs" style={META}>
                      {cell.basis}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

/**
 * The client's leading product in each state: by units sold, by samples
 * handed out and by what people said, side by side and never added
 * together. A state without enough recaps says so instead of naming a
 * product. A failed or slow load shows one sentence and leaves the rest of
 * the page alone.
 */
export const ProductRegions: React.FC<Window> = (props) => (
  <Guard title={REGIONS_TITLE} {...props}>
    <RegionsInner {...props} />
  </Guard>
);
