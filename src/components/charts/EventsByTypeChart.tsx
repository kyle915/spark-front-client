import "@/lib/chartSetup";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { memo } from "react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type EventsByTypeAnalytics = Record<string, number>;

const SPARK_PALETTE = [
  "rgba(242,243,238,0.90)", // lime
  "rgba(95,184,239,0.90)", // sky
  "rgba(239,90,42,0.90)", // orange
  "rgba(245,200,66,0.90)", // gold
  "rgba(255,255,255,0.35)",
  "rgba(242,243,238,0.45)",
];

function EventsByTypeChart({ analytics }: { analytics: EventsByTypeAnalytics }) {
  const labels = Object.keys(analytics);
  const dataValues = Object.values(analytics);

  const data = {
    labels,
    datasets: [
      {
        label: "Events by Type",
        data: dataValues,
        backgroundColor: labels.map(
          (_, i) => SPARK_PALETTE[i % SPARK_PALETTE.length],
        ),
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    indexAxis: "y" as const,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: "var(--spark-text-meta)" },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        ticks: { color: "var(--spark-text-secondary)" },
        grid: { display: false },
      },
    },
  };

  return <Bar data={data} options={options} />;
}

export default memo(EventsByTypeChart);
