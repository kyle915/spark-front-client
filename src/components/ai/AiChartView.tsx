import "@/lib/sparkChartRegister";
import { Chart } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import ChartBlock from "@/components/charts/ChartBlock";
import { labelsEveryRow, seriesLayout } from "@/lib/chartRows";
import {
  MAX_SERIES,
  barSeries,
  chartOptions,
  lineSeries,
  seriesColor,
  valueLabels,
} from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";

/**
 * The optional chart an Ask-AI answer can carry: `{ type, title, labels,
 * series }`, drawn as a bar or line chart under the answer text.
 *
 * One series is drawn in ink with no legend (the title names it). Two to
 * four share a chart, a fixed colour each, with a legend. More than four
 * become one small chart per series: a fifth colour is never generated, and
 * unrelated series cannot honestly be summed into "Other".
 */

export type AiChartSeries = {
  readonly label: string;
  readonly data: readonly number[];
};

export type AiChart = {
  readonly type: string;
  readonly title?: string | null;
  readonly labels: readonly string[];
  readonly series: readonly AiChartSeries[];
};

const lastValue = valueLabels("last");
const everyValue = valueLabels("all");

const dataset = (s: AiChartSeries, isLine: boolean, color?: string, area = false) =>
  isLine
    ? { type: "line" as const, ...lineSeries({ label: s.label, data: [...s.data], color, area }) }
    : { type: "bar" as const, ...barSeries({ label: s.label, data: [...s.data], color }) };

const AiChartView: React.FC<{ chart: AiChart }> = ({ chart }) => {
  useAppearance();
  const isLine = chart.type === "line";
  const type = isLine ? "line" : "bar";
  const labels = [...chart.labels];
  const layout = labels.length === 0 ? "none" : seriesLayout(chart.series.length, MAX_SERIES);

  // A lone line prints its last value; a short lone bar list prints them all.
  const soloPlugins = isLine ? [lastValue] : labelsEveryRow(labels.length) ? [everyValue] : [];
  const solo = (s: AiChartSeries): ChartData<"bar" | "line"> => ({
    labels,
    datasets: [dataset(s, isLine, undefined, true)],
  });

  return (
    <div className="mt-4">
      {chart.title ? (
        <p
          className="mb-2 text-[13px] font-medium"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {chart.title}
        </p>
      ) : null}
      {layout === "none" ? (
        <div className="spark-chart-empty">There is nothing to chart for this answer.</div>
      ) : layout === "single" ? (
        <div className="relative" style={{ height: 220 }}>
          <Chart
            type={type}
            data={solo(chart.series[0])}
            options={chartOptions<"bar" | "line">()}
            plugins={soloPlugins}
          />
        </div>
      ) : layout === "shared" ? (
        <div className="relative" style={{ height: 240 }}>
          <Chart
            type={type}
            data={{
              labels,
              datasets: chart.series.map((s, i) => dataset(s, isLine, seriesColor(i))),
            }}
            options={chartOptions<"bar" | "line">({ legend: true })}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {chart.series.map((s, i) => (
            <ChartBlock key={`${s.label}-${i}`} title={s.label} height={130}>
              <Chart
                type={type}
                data={solo(s)}
                options={chartOptions<"bar" | "line">()}
                plugins={isLine ? [lastValue] : []}
              />
            </ChartBlock>
          ))}
        </div>
      )}
    </div>
  );
};

export default AiChartView;
