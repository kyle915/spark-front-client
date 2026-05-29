import "@/lib/chartSetup";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
  registerables,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { useMemo } from "react";
import { Chart as ChartMix } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
  // register everything else to avoid missing controllers in production bundles
  ...registerables
);

interface MonthlyEvent {
  month: string;
  events: number;
  consumers: number;
  conversionRate: number;
}

interface Props {
  data: MonthlyEvent[];
}

const EventPerformanceChart = ({ data }: Props) => {

  const chartData = {
    labels: data.map((d) => d.month),
    datasets: [
      {
        type: "bar" as const,
        label: "Consumers Sampled",
        data: data.map((d) => d.consumers),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "#3b82f6",
        borderRadius: 4,
        yAxisID: "y-left",
        order: 2,
      },
      {
        type: "bar" as const,
        label: "Events",
        data: data.map((d) => d.events),
        backgroundColor: "rgba(139, 92, 246, 0.8)",
        borderColor: "#8b5cf6",
        borderRadius: 4,
        yAxisID: "y-left",
        order: 3,
      },
      {
        type: "line" as const,
        label: "Conversion Rate (%)",
        data: data.map((d) => d.conversionRate),
        borderColor: "#f87171",
        backgroundColor: "rgba(248, 113, 113, 0.2)",
        pointBackgroundColor: "#f87171",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 5,
        borderWidth: 2,
        fill: false,
        yAxisID: "y-right",
        order: 1,
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest" as const,
        intersect: true,
      },
      plugins: {
        legend: {
          position: "top",
          align: "center",
          labels: {
            color: "#374151",
            usePointStyle: true,
            pointStyle: "circle",
            padding: 20,
            font: {
              size: 12,
              weight: 600,
            },
          },
        },
        tooltip: {
          mode: "index",
          backgroundColor: "#fff",
          titleColor: "#000",
          bodyColor: "#374151",
          borderColor: "#374151",
          borderWidth: 1,
          titleFont: {
            size: 13,
            weight: 600,
          },
          bodyFont: {
            size: 12,
            weight: 300,
          },
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function (context: TooltipItem<"bar" | "line">) {
              const label = context.dataset.label || "";
              const value = context.raw;
              return label.includes("Rate")
                ? `${label}: ${value}%`
                : `${label}: ${value}`;
            },
          },
        },
        datalabels: {
          display: false,
        },
      },
      scales: {
        "y-left": {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: {
            display: true,
            text: "Consumers / Events",
            color:  "#374151",
            font: {
              size: 13,
              weight: "bold",
            },
          },
          ticks: {
            color: "#374151",
            font: {
              size: 13,
              weight: 300,
            },
          },
          grid: {
            color: "#e5e7eb",
          },
        },
        "y-right": {
          type: "linear",
          position: "right",
          beginAtZero: true,
          title: {
            display: true,
            text: "Conversion Rate (%)",
            color: "#374151",
            font: {
              size: 13,
              weight: "bold",
            },
          },
          ticks: {
            color:  "#374151",
            callback: (value) => `${value}%`,
          },
          grid: {
            drawOnChartArea: false,
          },
        },
        x: {
          ticks: {
            color: "#374151",
            font: {
              size: 12,
              weight: 300,
            },
            maxRotation: 0,
            minRotation: 0,
          },
          grid: {
            display: false,
          },
        },
      },
    }),
    []
  );

  return <ChartMix type="bar" data={chartData} options={options} />;
};

export default EventPerformanceChart;
