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
import { memo, useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";

import { useThemeMode } from "@/hooks/useThemeMode";
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
  const [isDark] = useThemeMode();

  const { textColor, gridColor } = useMemo(() => {
    return {
      textColor: isDark ? "#e5e7eb" : "#1f2937",
      gridColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    };
  }, [isDark]);

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

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        position: "top",
        labels: {
          color: textColor,
          usePointStyle: true,
        },
      },
    },

    scales: {
      x: {
        ticks: {
          color: textColor,
          maxRotation: 45,
          minRotation: 45,
        },
        grid: { color: gridColor },
      },

      y1: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
        title: {
          display: true,
          text: "Consumers Sampled",
          color: textColor,
        },
      },

      y2: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        min: 0,
        max: 35,
        ticks: {
          color: textColor,
          callback: (v) => `${v}%`,
        },
        grid: { drawOnChartArea: false },
        title: {
          display: true,
          text: "Conversion Rate (%)",
          color: textColor,
        },
      },
    },
  };

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
