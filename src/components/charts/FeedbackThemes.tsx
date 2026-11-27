import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Bar } from "react-chartjs-2";
import "@/lib/sparkChartRegister";
import ChartBlock from "@/components/charts/ChartBlock";
import ErrorBoundary from "@/components/ErrorBoundary";
import useSparkRole from "@/hooks/useSparkRole";
import { TenantFeedbackThemesQuery } from "@/api/queries/TenantFeedbackThemesQuery";
import type { TenantFeedbackThemesQuery as TenantFeedbackThemesQueryType } from "@api/queries/__generated__/TenantFeedbackThemesQuery.graphql";
import { RefreshTenantFeedbackThemesMutation } from "@/api/mutations/RefreshTenantFeedbackThemesMutation";
import type { RefreshTenantFeedbackThemesMutation as RefreshMutationType } from "@api/mutations/__generated__/RefreshTenantFeedbackThemesMutation.graphql";
import { labelsEveryRow } from "@/lib/chartRows";
import { shortLabel } from "@/lib/consumerBreakdown";
import { recapsLabel, themeBars, themeSections, themesBasis } from "@/lib/feedbackThemes";
import { barSeries, chartOptions, valueLabels } from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";

const everyValue = valueLabels("all");

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;

const TITLE = "What consumers said";
const CHART_TITLE = "Themes by recaps that mention them";
const ROW_HEIGHT = 34;

type Window = { tenantId: string; startDate: string; endDate: string };
type Themes = TenantFeedbackThemesQueryType["response"]["tenantFeedbackThemes"];

const Heading: React.FC = () => (
  <h3 className="display font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
    {TITLE}
  </h3>
);

/** The heading and one short sentence, when there is nothing to draw. */
const Quiet: React.FC<{ children: ReactNode; action?: ReactNode }> = ({ children, action }) => (
  <section aria-label={TITLE}>
    <Heading />
    <p className="text-sm py-2" style={META}>
      {children}
    </p>
    {action}
  </section>
);

const Inner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  useAppearance();
  const { isAdmin } = useSparkRole();
  const data = useLazyLoadQuery<TenantFeedbackThemesQueryType>(
    TenantFeedbackThemesQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  // A refresh answers with the new grouping; show it without a second load.
  const [refreshed, setRefreshed] = useState<Themes | null>(null);
  const [failed, setFailed] = useState(false);
  const [commit, refreshing] = useMutation<RefreshMutationType>(
    RefreshTenantFeedbackThemesMutation,
  );
  const result = refreshed ?? data.tenantFeedbackThemes;

  const sections = useMemo(() => themeSections(result.themes), [result]);
  const bars = useMemo(() => themeBars(result.themes), [result]);

  const refresh = () => {
    if (refreshing) return;
    setFailed(false);
    commit({
      variables: { tenantId, startDate, endDate },
      onCompleted: (res) => {
        const next = res.refreshTenantFeedbackThemes;
        if (next) setRefreshed(next);
        else setFailed(true);
      },
      onError: () => setFailed(true),
    });
  };

  // Staff only. The server refuses anyone else as well.
  const refreshControl = isAdmin ? (
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      className="text-xs underline underline-offset-2 print:hidden"
      style={{ ...SECONDARY, opacity: refreshing ? 0.6 : 1 }}
    >
      {refreshing ? "Grouping the comments again" : "Refresh"}
    </button>
  ) : null;

  if (result.status === "too_few") {
    return (
      <Quiet>
        Not enough consumer comments on approved recaps in these dates to group into themes.
      </Quiet>
    );
  }
  if (result.status !== "ready" || sections.length === 0) {
    return (
      <Quiet action={refreshControl}>
        Themes are not available right now.{failed ? " The refresh did not work." : ""}
      </Quiet>
    );
  }

  return (
    <section aria-label={TITLE} className="flex flex-col gap-5">
      <div>
        <Heading />
        <p className="text-xs" style={META}>
          {themesBasis(result.commentCount, result.recapCount, result.truncated)}{" "}
          {refreshControl}
          {failed ? " The refresh did not work." : ""}
        </p>
      </div>

      {/* One theme is a sentence in the list below, not a one-bar chart. */}
      {bars.length > 1 ? (
        <ChartBlock
          title={CHART_TITLE}
          height={Math.max(96, bars.length * ROW_HEIGHT + 36)}
          categoryHeader="Theme"
          valueHeader="Recaps"
          tableRows={bars.map((b) => ({ label: b.label, value: b.value }))}
        >
          <Bar
            data={{
              labels: bars.map((b) => shortLabel(b.label)),
              datasets: [
                barSeries({
                  label: "Recaps",
                  data: bars.map((b) => b.value),
                  horizontal: true,
                }),
              ],
            }}
            options={chartOptions<"bar">({ horizontal: true })}
            plugins={labelsEveryRow(bars.length) ? [everyValue] : []}
          />
        </ChartBlock>
      ) : null}

      <div className="grid gap-x-8 gap-y-6 md:grid-cols-3">
        {sections.map((section) => {
          const sentence = result.sentences.find((s) => s.section === section.key)?.text ?? "";
          return (
          <div key={section.key} className="min-w-0">
            <h4 className="text-[13px] font-medium mb-2" style={SECONDARY}>
              {section.title}
            </h4>
            {sentence ? (
              <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--spark-text)" }}>
                {sentence}
              </p>
            ) : null}
            <ul className="m-0 p-0 list-none flex flex-col gap-3">
              {section.themes.map((theme) => (
                <li key={theme.label} className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--spark-text)" }}>
                    {theme.label}
                    <span className="font-normal" style={META}>
                      {" · "}
                      {recapsLabel(theme.recapCount)}
                    </span>
                  </p>
                  {theme.quote && theme.quote !== sentence ? (
                    <p className="text-sm mt-0.5 break-words" style={SECONDARY}>
                      “{theme.quote}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          );
        })}
      </div>
    </section>
  );
};

/**
 * Consumer comments from approved recaps, grouped into themes: a ranked bar
 * of every theme, then what people liked, why they passed and what they
 * asked, each with one comment as written. A failed or slow load shows one
 * sentence and leaves the rest of the page alone.
 */
export const FeedbackThemes: React.FC<Window> = (props) => (
  // Keyed on the window so a failed load does not stick after the dates change.
  <ErrorBoundary
    key={`${props.tenantId}|${props.startDate}|${props.endDate}`}
    fallback={<Quiet>Themes could not load.</Quiet>}
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

export default FeedbackThemes;
