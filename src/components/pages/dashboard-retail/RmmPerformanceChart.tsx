import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart as ChartMixed } from "react-chartjs-2";
import { memo, useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { useThemeMode } from "@/hooks/useThemeMode";
import { inkRgba } from "@/theme/chartInk";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export type RmmPerformanceItem = {
  rmm: string;
  consumers: number;
  demos: number;
  conversion: number;
};

function RmmPerformanceChart({ data }: { data: RmmPerformanceItem[] }) {
  const [isDark] = useThemeMode();

  const { textColor, gridColor } = useMemo(() => {
    return {
      textColor: isDark ? "#e5e7eb" : "#1f2937",
      gridColor: isDark ? inkRgba(0.12) : "rgba(0,0,0,0.1)",
    };
  }, [isDark]);

  const chartData: ChartData<"bar" | "line"> = {
    labels: data.map((d) => d.rmm),
    datasets: [
      {
        type: "bar",
        label: "Consumers Sampled",
        data: data.map((d) => d.consumers),
        backgroundColor: "rgba(16, 185, 129, 0.85)", // green
        borderRadius: 6,
        yAxisID: "y1",
      },
      {
        type: "bar",
        label: "Demos",
        data: data.map((d) => d.demos),
        backgroundColor: "rgba(59, 130, 246, 0.85)", // blue
        borderRadius: 6,
        yAxisID: "y1",
      },
      {
        type: "line",
        label: "Conversion Rate (%)",
        data: data.map((d) => d.conversion),
        borderColor: "rgb(239, 68, 68)", // red
        pointBackgroundColor: "rgb(239, 68, 68)",
        borderWidth: 3,
        tension: 0.35,
        yAxisID: "y2",
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: textColor,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            if (context.dataset.type === "line") {
              return `${context.raw}% conversion`;
            }
            return `${context.raw}`;
          },
        },
      },
    },
    scales: {
      y1: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
        title: {
          display: true,
          text: "Consumers / Demos",
          color: textColor,
        },
      },
      y2: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        ticks: {
          color: textColor,
          callback: (v) => `${v}%`,
        },
        grid: {
          drawOnChartArea: false,
        },
        title: {
          display: true,
          text: "Conversion (%)",
          color: textColor,
        },
      },
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
  };

  return (
    <ChartMixed
      key={isDark ? "dark" : "light"}
      type="bar"
      data={chartData}
      options={options}
    />
  );
}

export default memo(RmmPerformanceChart);
