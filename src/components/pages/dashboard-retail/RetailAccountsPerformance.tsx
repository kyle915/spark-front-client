import { memo, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import type { TooltipItem } from "chart.js";
import { Bar } from "react-chartjs-2";
import { Store } from "lucide-react";
import ChartCard from "@/components/charts/ChartCard";
import { useThemeMode } from "@/hooks/useThemeMode";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export type RetailAccount = {
  name: string;
  consumers: number;
  conversion: number;
  color: string;
};

export default memo(function RetailAccountsPerformance({
  data,
}: {
  data: RetailAccount[];
}) {
  const [filter, setFilter] = useState<"top10" | "all">("top10");
  const [search, setSearch] = useState("");

  const [isDark] = useThemeMode();

  const { textColor, gridColor } = useMemo(
    () => ({
      textColor: isDark ? "#e5e7eb" : "#1f2937",
      gridColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    }),
    [isDark]
  );

  // Filtering & Sorting
  const filteredData = useMemo(() => {
    let rows = [...data];

    if (filter === "top10") {
      rows = rows.sort((a, b) => b.consumers - a.consumers).slice(0, 10);
    }

    if (search.trim()) {
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return rows;
  }, [data, filter, search]);

  const chartData = {
    labels: filteredData.map((a) => a.name),
    datasets: [
      {
        label: "Consumers Sampled",
        data: filteredData.map((a) => a.consumers),
        backgroundColor: filteredData.map((a) => a.color),
        borderRadius: 5,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
        title: {
          display: true,
          text: "Number of Consumers",
          color: textColor,
        },
      },
      y: {
        ticks: { color: textColor, font: { size: 12 } },
        grid: { display: false },
      },
    },

    plugins: {
      legend: { display: false },

      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"bar">) => {
            const account = filteredData[ctx.dataIndex];
            return [
              `Consumers: ${account.consumers.toLocaleString()}`,
              `Conversion: ${account.conversion}%`,
            ];
          },
        },
      },
    },
  };

  return (
    <ChartCard
      title="Retail Accounts Performance"
      icon={Store}
      iconColor="text-orange-600"
      fixedHeight
    >
      {/* Filters */}
      <div className="flex items-center justify-between mb-4 gap-3">
        {/* Dropdown */}
        <select
          className="select select-bordered select-sm w-40"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "top10" | "all")}
        >
          <option value="top10">Top 10 Accounts</option>
          <option value="all">All Accounts</option>
        </select>

        <select
          className="select select-bordered select-sm w-40"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "top10" | "all")}
        >
          <option value="all">All Distributor</option>
          <option value="alStraubl">Straub</option>
          <option value="JohnLenore">John Lenore</option>
          <option value="NevBev">Nev Bev</option>
          <option value="AB1Sylmar">AB1 Sylmar</option>
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by account name..."
          className="input input-bordered input-sm w-60"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="w-full h-[460px]">
        <Bar data={chartData} options={options} />
      </div>
    </ChartCard>
  );
});
