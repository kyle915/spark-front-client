import "@/lib/sparkChartRegister";
import { Bar } from "react-chartjs-2";
import { memo } from "react";
import { TrendingUp } from "lucide-react";
import ChartCard from "@/components/charts/ChartCard";
import ChartBlock from "@/components/charts/ChartBlock";
import { labelsEveryRow } from "@/lib/chartRows";
import { barSeries, chartOptions, percentLabel, valueLabels } from "@/lib/sparkChart";

export type ReachConversionItem = {
  market: string;
  consumers: number;
  conversion: number;
};

const everyCount = valueLabels("all");
const everyPercent = valueLabels("all", percentLabel);

/**
 * Reach is a count and conversion is a rate: two scales, so two charts on
 * one market axis, in the order the markets arrive.
 */
function ReachConversionChart({ data }: { data: ReachConversionItem[] }) {
  const labels = data.map((d) => d.market);
  const labelled = labelsEveryRow(data.length);

  return (
    <ChartCard
      title="Consumer reach and conversion"
      icon={TrendingUp}
      fixedHeight
      empty={data.length === 0}
      emptyMessage="No market activity in this range yet."
    >
      <div className="flex flex-col gap-5">
        <ChartBlock title="Consumers sampled by market" height={190}>
          <Bar
            data={{
              labels,
              datasets: [
                barSeries({
                  label: "Consumers sampled",
                  data: data.map((d) => d.consumers),
                }),
              ],
            }}
            options={chartOptions<"bar">()}
            plugins={labelled ? [everyCount] : []}
          />
        </ChartBlock>
        <ChartBlock title="Conversion rate by market" height={150}>
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
            plugins={labelled ? [everyPercent] : []}
          />
        </ChartBlock>
      </div>
    </ChartCard>
  );
}

export default memo(ReachConversionChart);
