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

// hook theme
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

export type MonthlyTrend = {
  month: string;
  consumers: number;
  purchases: number;
  conversion: number;
};

function MonthlyTrendsChart({ data }: { data: MonthlyTrend[] }) {
  const [isDark] = useThemeMode();

  const { textColor, gridColor } = useMemo(() => {
    return {
      textColor: isDark ? "#e5e7eb" : "#1f2937",
      gridColor: isDark ? inkRgba(0.12) : "rgba(0,0,0,0.1)",
    };
  }, [isDark]);

  const chartData: ChartData<"bar" | "line"> = {
    labels: data.map((d) => d.month),
    datasets: [
      {
        type: "line",
        label: "Conversion Rate (%)",
        data: data.map((d) => d.conversion),
        borderColor: "rgb(234, 179, 8)",
        pointBackgroundColor: "rgb(234, 179, 8)",
        borderWidth: 3,
        tension: 0.35,
        yAxisID: "y2",
      },
      {
        type: "line",
        label: "Purchases",
        data: data.map((d) => d.purchases),
        fill: true,
        borderColor: "rgba(16, 185, 129, 0.85)",
        backgroundColor: "rgba(16, 185, 129, 0.5)",
        tension: 0.35,
        yAxisID: "y1",
      },
      {
        type: "line",
        label: "Consumers Sampled",
        data: data.map((d) => d.consumers),
        borderColor: "rgba(59, 130, 246, 0.85)",
        fill: true,
        backgroundColor: "rgba(59, 131, 246, 0.5)",
        tension: 0.5,
        yAxisID: "y1",
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
          text: "Consumers / Purchases",
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
        grid: { drawOnChartArea: false },
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
      type="line"
      data={chartData}
      options={options}
    />
  );
}

export default memo(MonthlyTrendsChart);
