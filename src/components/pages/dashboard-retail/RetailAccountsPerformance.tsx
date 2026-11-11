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
import { useForm } from "react-hook-form";
import ChartCard from "@/components/charts/ChartCard";
import { useThemeMode } from "@/hooks/useThemeMode";
import FormAutocomplete from "@/shared/FormAutocomplete";
import { useGlobalDistributors } from "../hooks/useGlobalDistributors";
import { inkRgba } from "@/theme/chartInk";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export type RetailAccount = {
  name: string;
  consumers: number;
  conversion: number;
  color: string;
  distributorId: string;
};

type DistributorFilterValues = {
  distributor: string | null;
};

export default memo(function RetailAccountsPerformance({
  data,
}: {
  data: RetailAccount[];
}) {
  const [filter, setFilter] = useState<"top10" | "all">("top10");
  const [search, setSearch] = useState("");

  const { distributors, loading } = useGlobalDistributors();

  const { control, watch } = useForm<DistributorFilterValues>({
    defaultValues: {
      distributor: "",
    },
  });

  const selectedDistributorValue = watch("distributor");

  const [isDark] = useThemeMode();

  const { textColor, gridColor } = useMemo(
    () => ({
      textColor: isDark ? "#e5e7eb" : "#1f2937",
      gridColor: isDark ? inkRgba(0.1) : "rgba(0,0,0,0.08)",
    }),
    [isDark],
  );

  /* =========================
     Local Filtering
  ========================== */

  const filteredData = useMemo(() => {
    let rows = [...data];

    // 🔥 Distributor filter LOCAL
    if (selectedDistributorValue) {
      rows = rows.filter((r) => r.distributorId === selectedDistributorValue);
    }

    if (filter === "top10") {
      rows = rows.sort((a, b) => b.consumers - a.consumers).slice(0, 10);
    }

    if (search.trim()) {
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()),
      );
    }

    return rows;
  }, [data, filter, search, selectedDistributorValue]);

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
      <div className="flex items-center justify-between mb-4 gap-3">
        <select
          className="select select-bordered select-sm w-40"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "top10" | "all")}
        >
          <option value="top10">Top 10 Accounts</option>
          <option value="all">All Accounts</option>
        </select>

        <FormAutocomplete<DistributorFilterValues>
          control={control}
          name="distributor"
          label=""
          options={[{ value: "", label: "All Distributors" }, ...distributors]}
          loading={loading}
          placeholder={loading ? "Loading..." : "Search distributor..."}
          containerClassName="w-64 [&_.label]:hidden"
          inputClassName="input-sm"
        />

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
