import { memo, useMemo, useState } from "react";
import "@/lib/sparkChartRegister";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Bar } from "react-chartjs-2";
import { Store } from "lucide-react";
import { useForm } from "react-hook-form";
import ChartCard from "@/components/charts/ChartCard";
import FormAutocomplete from "@/shared/FormAutocomplete";
import { useGlobalDistributors } from "../hooks/useGlobalDistributors";
import { labelsEveryRow } from "@/lib/chartRows";
import { barSeries, chartOptions, percentLabel, valueLabels } from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";

const everyCount = valueLabels("all");

export type RetailAccount = {
  name: string;
  consumers: number;
  conversion: number;
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
  useAppearance();
  const [filter, setFilter] = useState<"top10" | "all">("top10");
  const [search, setSearch] = useState("");

  const { distributors, loading } = useGlobalDistributors();

  const { control, watch } = useForm<DistributorFilterValues>({
    defaultValues: {
      distributor: "",
    },
  });

  const selectedDistributorValue = watch("distributor");

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
      barSeries({
        label: "Consumers sampled",
        data: filteredData.map((a) => a.consumers),
        horizontal: true,
      }),
    ],
  };

  // The bar is consumers sampled; the tooltip adds that account's conversion,
  // which the chart beside this one also plots.
  const base = chartOptions<"bar">({ horizontal: true });
  const options: ChartOptions<"bar"> = {
    ...base,
    plugins: {
      ...base.plugins,
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          ...base.plugins?.tooltip?.callbacks,
          afterLabel: (ctx: TooltipItem<"bar">) => {
            const account = filteredData[ctx.dataIndex];
            return account ? `Conversion ${percentLabel(account.conversion)}` : "";
          },
        },
      },
    },
  };

  return (
    <ChartCard
      title="Consumers sampled by account"
      icon={Store}
      fixedHeight
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <select
          className="select select-bordered select-sm w-40"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "top10" | "all")}
        >
          <option value="top10">Top 10 accounts</option>
          <option value="all">All accounts</option>
        </select>

        <FormAutocomplete<DistributorFilterValues>
          control={control}
          name="distributor"
          label=""
          options={[{ value: "", label: "All distributors" }, ...distributors]}
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
        {filteredData.length === 0 ? (
          <div className="spark-chart-empty">No accounts match these filters.</div>
        ) : (
          <Bar
            data={chartData}
            options={options}
            plugins={labelsEveryRow(filteredData.length) ? [everyCount] : []}
          />
        )}
      </div>
    </ChartCard>
  );
});
