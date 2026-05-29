import "@/lib/chartSetup";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type RequestsAnalytics = Record<string, number>;

export default function RequestsByTypeChart({ analytics }: { analytics: RequestsAnalytics }) {
  const labels = Object.keys(analytics);
  const values = Object.values(analytics);

  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Requests",
        data: values,
        backgroundColor: "rgba(99, 102, 241, 0.6)", // Indigo
        borderColor: "rgba(99, 102, 241, 1)",
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
  };

  return <Bar data={data} options={options} />;
}
