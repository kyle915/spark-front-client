import "@/lib/chartSetup";
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

import { Chart as ReactChart } from "react-chartjs-2";
import { memo } from "react";
import type { ChartData, ChartOptions } from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

type RmmPerformanceDatum = {
  market?: string | null;
  rmm: string;
  consumers: number;
  demos: number;
  conversion: number;
};

const abbreviate = (name: string | undefined | null) => {
  if (!name) return "Unknown";
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[1][0]}.`;
};

function RMMPerformanceChart({ data }: { data: RmmPerformanceDatum[] }) {
  const sorted = [...data]
    .sort((a, b) => b.consumers - a.consumers)
    .map((d) => ({
      ...d,
      rmm: abbreviate(d.market ?? d.rmm),
    }));

  const chartData: ChartData<"bar" | "line"> = {
    labels: sorted.map((d) => d.rmm),
    datasets: [
      {
        type: "bar",
        label: "Consumers Sampled",
        data: sorted.map((d) => d.consumers),
        backgroundColor: "rgba(34, 197, 94, 0.8)",
        borderRadius: 5,
        yAxisID: "y1",
      },
      {
        type: "bar",
        label: "Demos",
        data: sorted.map((d) => d.demos),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderRadius: 5,
        yAxisID: "y1",
      },
      {
        type: "line",
        label: "Conversion Rate (%)",
        data: sorted.map((d) => d.conversion),
        borderColor: "#f87171",
        borderWidth: 3,
        pointRadius: 6,
        yAxisID: "y2",
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" as const } },
    scales: {
      y1: { beginAtZero: true, position: "left" },
      y2: {
        beginAtZero: true,
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: { callback: (v: number | string) => `${v}%` },
      },
      x: { title: { display: true, text: "RMM" } },
    },
  };

  return <ReactChart<"bar" | "line"> type="bar" data={chartData} options={options} />;
}

export default memo(RMMPerformanceChart);
