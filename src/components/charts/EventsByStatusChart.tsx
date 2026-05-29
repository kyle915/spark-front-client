import "@/lib/chartSetup";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { memo } from "react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type EventsByStatusAnalytics = Record<string, number>;

function EventsByStatusChart({ analytics }: { analytics: EventsByStatusAnalytics }) {
  const labels = Object.keys(analytics);
  const dataValues = Object.values(analytics);

  const data = {
    labels,
    datasets: [
      {
        label: "Events by Status",
        data: dataValues,
        backgroundColor: "#3b82f6"
      }
    ]
  };

  const options = { responsive: true };

  return <Bar data={data} options={options} />;
}

export default memo(EventsByStatusChart);
