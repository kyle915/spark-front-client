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

type EventsByStatusAnalytics = Record<string, number>;

function EventsByStatusChart({
  analytics,
}: {
  analytics: EventsByStatusAnalytics;
}) {
  const labels = Object.keys(analytics);
  const dataValues = Object.values(analytics);

  const data = {
    labels,
    datasets: [
      {
        label: "Events by Status",
        data: dataValues,
        backgroundColor: "rgba(95,184,239,0.90)",
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: "var(--spark-text-meta)" },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        ticks: { color: "var(--spark-text-secondary)" },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  return <Bar data={data} options={options} />;
}

export default memo(EventsByStatusChart);
