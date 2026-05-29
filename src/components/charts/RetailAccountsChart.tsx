import "@/lib/chartSetup";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { memo, useMemo, useState } from "react";

type RetailAccount = {
  account: string;
  consumers: number;
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default memo(function RetailAccountsChart({ data }: { data: RetailAccount[] }) {
  const [filterType, setFilterType] = useState("top10");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.consumers - a.consumers);
    let list = sorted;
    if (filterType === "top10") list = list.slice(0, 10);
    if (search.length > 0) {
      list = list.filter((d) =>
        d.account.toLowerCase().includes(search.toLowerCase())
      );
    }
    return list;
  }, [data, filterType, search]);

  const chartData = {
    labels: filtered.map((d) => d.account),
    datasets: [
      {
        label: "Consumers",
        data: filtered.map((d) => d.consumers),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "#3b82f6",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true },
      y: { ticks: { autoSkip: false } },
    },
  };

  return (
    <div className="flex flex-col h-full">
      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-2">
        <select
          className="select select-bordered w-full sm:w-48"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="top10">Top 10</option>
          <option value="all">All Accounts</option>
        </select>

        <input
          className="input input-bordered w-full sm:w-64"
          placeholder="Search account..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* CHART */}
      <div className="flex-grow">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
});
