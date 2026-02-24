import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchQuery } from "react-relay";
import { useForm } from "react-hook-form";
import ChartCard from "@/components/charts/ChartCard";
import environment from "@/api/relay/environment";
import { DistributorsQuery } from "@/api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@/api/queries/__generated__/DistributorsQuery.graphql";
import { useThemeMode } from "@/hooks/useThemeMode";
import FormAutocomplete from "@/shared/FormAutocomplete";
import { useAuthStore } from "@/store/authStore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export type RetailAccount = {
  name: string;
  consumers: number;
  conversion: number;
  color: string;
};

type DistributorOption = {
  value: string;
  label: string;
};

type DistributorFilterValues = {
  distributor: string | null;
};

type DistributorConnection = DistributorsQueryType["response"]["distributors"];
type DistributorNode = DistributorConnection["edges"][number]["node"];

export default memo(function RetailAccountsPerformance({
  data,
  distributors = [],
  selectedDistributor = "",
  onDistributorChange,
}: {
  data: RetailAccount[];
  distributors?: DistributorOption[];
  selectedDistributor?: string;
  onDistributorChange?: (value: string) => void;
}) {
  const tenantId = useAuthStore((state) => state.tenantId);
  const [filter, setFilter] = useState<"top10" | "all">("top10");
  const [search, setSearch] = useState("");
  const [distributorSearch, setDistributorSearch] = useState("");
  const [isLoadingDistributors, setIsLoadingDistributors] = useState(false);
  const [distributorOptions, setDistributorOptions] =
    useState<DistributorOption[]>(distributors);
  const distributorRequestIdRef = useRef(0);
  const isSyncingFromPropsRef = useRef(false);
  const lastSelectedDistributorRef = useRef(selectedDistributor);
  const { control, watch, setValue, getValues } = useForm<DistributorFilterValues>({
    defaultValues: {
      distributor: selectedDistributor || "",
    },
  });
  const selectedDistributorValue = watch("distributor");

  const [isDark] = useThemeMode();

  const { textColor, gridColor } = useMemo(
    () => ({
      textColor: isDark ? "#e5e7eb" : "#1f2937",
      gridColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    }),
    [isDark]
  );

  const loadDistributors = useCallback(
    async (searchQuery: string) => {
      const requestId = ++distributorRequestIdRef.current;
      setIsLoadingDistributors(true);

      try {
        let after: string | null = null;
        const allNodes: DistributorNode[] = [];

        while (true) {
          const response: DistributorsQueryType["response"] | null | undefined =
            await fetchQuery<DistributorsQueryType>(
              environment,
              DistributorsQuery,
              {
                filters: tenantId ? { tenantId } : {},
                q: searchQuery || null,
                first: 100,
                after,
              }
            ).toPromise();

          if (distributorRequestIdRef.current !== requestId) return;

          const connection: DistributorConnection | undefined =
            response?.distributors;
          const nodes =
            connection?.edges
              .map((edge: DistributorConnection["edges"][number]) => edge.node)
              .filter(
                (node: DistributorNode | null | undefined): node is DistributorNode =>
                  Boolean(node)
              ) ?? [];

          allNodes.push(...nodes);

          const hasNextPage = connection?.pageInfo?.hasNextPage;
          const endCursor: string | null = connection?.pageInfo?.endCursor ?? null;
          if (!hasNextPage || !endCursor) break;
          after = endCursor;
        }

        const options = allNodes.map((node) => ({
          value: node.id,
          label: node.name ?? node.email ?? node.id,
        }));

        setDistributorOptions(options);
      } catch {
        if (distributorRequestIdRef.current !== requestId) return;
        setDistributorOptions(distributors);
      } finally {
        if (distributorRequestIdRef.current === requestId) {
          setIsLoadingDistributors(false);
        }
      }
    },
    [distributors, tenantId]
  );

  useEffect(() => {
    const nextValue = selectedDistributor || "";
    const currentValue = getValues("distributor") ?? "";
    if (currentValue === nextValue) {
      lastSelectedDistributorRef.current = nextValue;
      return;
    }

    isSyncingFromPropsRef.current = true;
    lastSelectedDistributorRef.current = nextValue;
    setValue("distributor", nextValue);
  }, [getValues, selectedDistributor, setValue]);

  useEffect(() => {
    if (isSyncingFromPropsRef.current) {
      isSyncingFromPropsRef.current = false;
      return;
    }

    const nextValue = selectedDistributorValue ?? "";
    if (nextValue === lastSelectedDistributorRef.current) return;

    lastSelectedDistributorRef.current = nextValue;
    onDistributorChange?.(nextValue);
  }, [onDistributorChange, selectedDistributorValue]);

  useEffect(() => {
    void loadDistributors(distributorSearch.trim());
  }, [distributorSearch, loadDistributors]);

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
  const distributorAutocompleteOptions = useMemo(
    () => [{ value: "", label: "All Distributors" }, ...distributorOptions],
    [distributorOptions]
  );

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

        <FormAutocomplete<DistributorFilterValues>
          control={control}
          name="distributor"
          label=""
          options={distributorAutocompleteOptions}
          onSearch={setDistributorSearch}
          loading={isLoadingDistributors}
          placeholder={
            isLoadingDistributors
              ? "Loading distributors..."
              : "Search distributor..."
          }
          containerClassName="w-64 [&_.label]:hidden"
          inputClassName="input-sm"
        />

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
