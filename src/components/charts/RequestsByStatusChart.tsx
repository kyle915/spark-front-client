import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

type RequestsAnalytics = Record<string, number>;

export default function RequestsByStatusChart({ analytics }: { analytics: RequestsAnalytics }) {
  const labels = Object.keys(analytics);
  const values = Object.values(analytics);

  const data: ChartData<"doughnut"> = {
    labels,
    datasets: [
      {
        label: "Requests",
        data: values,
        backgroundColor: [
          "rgba(16, 185, 129, 0.6)",
          "rgba(239, 68, 68, 0.6)",
          "rgba(234, 179, 8, 0.6)",
          "rgba(59, 130, 246, 0.6)",
        ],
        borderColor: [
          "rgba(16, 185, 129, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(59, 130, 246, 1)",
        ],
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    plugins: {
      legend: { position: "right" as const },
    },
  };

  return <Doughnut data={data} options={options} />;
}
