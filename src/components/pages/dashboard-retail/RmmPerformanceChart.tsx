import "@/lib/sparkChartRegister";
import { Bar } from "react-chartjs-2";
import { memo } from "react";
import ChartBlock from "@/components/charts/ChartBlock";
import { labelsEveryRow } from "@/lib/chartRows";
import {
  barSeries,
  chartOptions,
  percentLabel,
  seriesColor,
  valueLabels,
} from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";

export type RmmPerformanceItem = {
  rmm: string;
  consumers: number;
  demos: number;
  conversion: number;
};

const everyPercent = valueLabels("all", percentLabel);

/**
 * Counts and a rate are two scales, so they are two charts on one RMM axis:
 * consumers sampled and demos above, conversion rate below.
 */
function RmmPerformanceChart({ data }: { data: RmmPerformanceItem[] }) {
  useAppearance();
  if (data.length === 0) {
    return <div className="spark-chart-empty">No RMM activity in this range yet.</div>;
  }
  const labels = data.map((d) => d.rmm);

  return (
    <div className="flex flex-col gap-5">
      <ChartBlock title="Consumers sampled and demos" height={210}>
        <Bar
          data={{
            labels,
            datasets: [
              barSeries({
                label: "Consumers sampled",
                data: data.map((d) => d.consumers),
                color: seriesColor(0),
              }),
              barSeries({
                label: "Demos",
                data: data.map((d) => d.demos),
                color: seriesColor(1),
              }),
            ],
          }}
          options={chartOptions<"bar">({ legend: true })}
        />
      </ChartBlock>
      <ChartBlock title="Conversion rate" height={130}>
        <Bar
          data={{
            labels,
            datasets: [
              barSeries({
                label: "Conversion rate",
                data: data.map((d) => d.conversion),
              }),
            ],
          }}
          options={chartOptions<"bar">({ format: percentLabel })}
          plugins={labelsEveryRow(data.length) ? [everyPercent] : []}
        />
      </ChartBlock>
    </div>
  );
}

export default memo(RmmPerformanceChart);
