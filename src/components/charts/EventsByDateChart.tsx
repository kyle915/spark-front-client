import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type EventsByDateAnalytics = Record<string, number>;

export default function EventsByDateChart({ analytics }: { analytics: EventsByDateAnalytics }) {
  const labels = Object.keys(analytics).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const values = labels.map(l => analytics[l]);

  const data = {
    labels,
    datasets: [
      {
        label: "Events by Date",
        data: values,
        borderColor: "#ef4444",
        backgroundColor: "#fecaca",
        tension: 0.3,
        fill: true,
      }
    ]
  };

  return <Line data={data} />;
}
