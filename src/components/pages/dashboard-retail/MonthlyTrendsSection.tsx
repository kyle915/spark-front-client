import "@/lib/sparkChartRegister";
import { Line } from "react-chartjs-2";
import { memo } from "react";
import ChartBlock from "@/components/charts/ChartBlock";
import {
  chartOptions,
  lineSeries,
  percentLabel,
  seriesColor,
  valueLabels,
} from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";

export type MonthlyTrend = {
  month: string;
  consumers: number;
  purchases: number;
  conversion: number;
};

const lastPercent = valueLabels("last", percentLabel);

/**
 * Counts and a rate are two scales, so they are two charts on one month
 * axis: consumers sampled and purchases above, conversion rate below.
 */
function MonthlyTrendsChart({ data }: { data: MonthlyTrend[] }) {
  useAppearance();
  if (data.length === 0) {
    return <div className="spark-chart-empty">No monthly activity in this range yet.</div>;
  }
  const labels = data.map((d) => d.month);

  return (
    <div className="flex flex-col gap-5">
      <ChartBlock title="Consumers sampled and purchases" height={210}>
        <Line
          data={{
            labels,
            datasets: [
              lineSeries({
                label: "Consumers sampled",
                data: data.map((d) => d.consumers),
                color: seriesColor(0),
              }),
              lineSeries({
                label: "Purchases",
                data: data.map((d) => d.purchases),
                color: seriesColor(1),
              }),
            ],
          }}
          options={chartOptions<"line">({ legend: true })}
        />
      </ChartBlock>
      <ChartBlock title="Conversion rate" height={130}>
        <Line
          data={{
            labels,
            datasets: [
              lineSeries({
                label: "Conversion rate",
                data: data.map((d) => d.conversion),
                area: true,
              }),
            ],
          }}
          options={chartOptions<"line">({ format: percentLabel })}
          plugins={[lastPercent]}
        />
      </ChartBlock>
    </div>
  );
}

export default memo(MonthlyTrendsChart);
