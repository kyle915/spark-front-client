import "@/lib/chartSetup";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";
import { Chart as ChartMix } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { memo } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

type MarketPerformanceDatum = {
  market: string;
  consumers: number;
  conversion: number;
};

type MixedChartType = "bar" | "line";

export default memo(function MarketPerformanceChart({ data }: { data: MarketPerformanceDatum[] }) {
  const chartData: ChartData<MixedChartType> = {
    labels: data.map((d) => d.market),
    datasets: [
      {
        type: "bar",
        label: "Consumers Sampled",
        data: data.map((d) => d.consumers),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "#3b82f6",
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: "y1",
      },
      {
        type: "line",
        label: "Conversion Rate (%)",
        data: data.map((d) => d.conversion),
        borderColor: "#f87171",
        borderWidth: 3,
        pointBackgroundColor: "#f87171",
        pointRadius: 6,
        yAxisID: "y2",
      },
    ],
  };

  const options: ChartOptions<MixedChartType> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" as const } },
    scales: {
      y1: { beginAtZero: true, position: "left" },
      y2: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false } },
    },
  };

  return <ChartMix<MixedChartType> type="bar" data={chartData} options={options} />;
});
