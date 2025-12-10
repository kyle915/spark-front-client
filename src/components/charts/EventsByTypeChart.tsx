import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { memo } from "react";

ChartJS.register(ArcElement, Tooltip, Legend);

type EventsByTypeAnalytics = Record<string, number>;

function EventsByTypeChart({ analytics }: { analytics: EventsByTypeAnalytics }) {
  const labels = Object.keys(analytics);
  const dataValues = Object.values(analytics);

  const data = {
    labels,
    datasets: [
      {
        label: "Events by Type",
        data: dataValues,
        backgroundColor: [
          "#6366f1",
          "#10b981",
          "#f97316",
          "#ef4444",
          "#06b6d4",
          "#8b5cf6"
        ]
      }
    ]
  };

  return <Pie data={data} />;
}

export default memo(EventsByTypeChart);
