import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Chart as ChartMixed } from "react-chartjs-2";
import { memo } from "react";
import type { ChartData } from "chart.js";

import { sparkChartOptions } from "@/lib/chartTheme";
import ChartCard from "@/components/charts/ChartCard";
import { TrendingUp } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export type ReachConversionItem = {
  market: string;
  consumers: number;
  conversion: number;
};

function ReachConversionChart({ data }: { data: ReachConversionItem[] }) {
  const chartData: ChartData<"bar" | "line"> = {
    labels: data.map((d) => d.market),
    datasets: [
      {
        type: "bar",
        label: "Consumers Sampled",
        data: data.map((d) => d.consumers),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderRadius: 6,
        yAxisID: "y1",
      },
      {
        type: "line",
        label: "Conversion Rate (%)",
        data: data.map((d) => d.conversion),
        borderColor: "rgb(224, 36, 94)",
        backgroundColor: "rgb(224, 36, 94)",
        pointBackgroundColor: "white",
        pointBorderWidth: 2,
        borderWidth: 3,
        tension: 0.35,
        yAxisID: "y2",
      },
    ],
  };

  const options = sparkChartOptions<"bar" | "line">({
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },

      y1: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        title: {
          display: true,
          text: "Consumers Sampled",
        },
      },

      y2: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        min: 0,
        max: 100,
        ticks: {
          callback: (v) => `${v}%`,
        },
        grid: { drawOnChartArea: false },
        title: {
          display: true,
          text: "Conversion Rate (%)",
        },
      },
    },
  });

  return (
    <ChartCard
      title="Consumer Reach vs Conversion"
      icon={TrendingUp}
      iconColor="text-orange-500"
      fixedHeight
    >
      <ChartMixed type="bar" data={chartData} options={options} />
    </ChartCard>
  );
}

export default memo(ReachConversionChart);
