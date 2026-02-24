import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DollarSign } from "lucide-react";
import { fetchQuery } from "react-relay";
import { useForm } from "react-hook-form";
import ChartCard from "@/components/charts/ChartCard";
import environment from "@/api/relay/environment";
import { DistributorsQuery } from "@/api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@/api/queries/__generated__/DistributorsQuery.graphql";
import FormAutocomplete from "@/shared/FormAutocomplete";
import { useAuthStore } from "@/store/authStore";

type MarketRow = {
  market: string;
  consumers: number;
  purchases: number;
  conversion: number;
  demos: number;
  efficiency: number;
};

const filterOptions = [
  "All Retails",
  "Top 10 by Efficiency",
  "Top 10 by Conversion",
  "Top 10 by Purchases",
] as const;

type DistributorOption = {
  value: string;
  label: string;
  searchText?: string;
};

type DistributorFilterValues = {
  distributor: string | null;
};

type DistributorConnection = DistributorsQueryType["response"]["distributors"];
type DistributorNode = DistributorConnection["edges"][number]["node"];

function filterMarkets(data: MarketRow[], filter: string): MarketRow[] {
  switch (filter) {
    case "Top 10 by Efficiency":
      return [...data].sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);

    case "Top 10 by Conversion":
      return [...data].sort((a, b) => b.conversion - a.conversion).slice(0, 10);

    case "Top 10 by Purchases":
      return [...data].sort((a, b) => b.purchases - a.purchases).slice(0, 10);

    default:
      return data;
  }
}

export default memo(function MarketPerformanceTable({
  data,
  rowsPerPage = 7,
  distributors = [],
  selectedDistributor = "",
  onDistributorChange,
}: {
  data: MarketRow[];
  rowsPerPage?: number;
  distributors?: DistributorOption[];
  selectedDistributor?: string;
  onDistributorChange?: (value: string) => void;
}) {
  const tenantId = useAuthStore((state) => state.tenantId);
  const [filter, setFilter] = useState<string>("All Retails");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
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
          searchText: [node.name, node.email].filter(Boolean).join(" "),
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
    setPage(1);
  }, [onDistributorChange, selectedDistributorValue]);

  useEffect(() => {
    void loadDistributors(distributorSearch.trim());
  }, [distributorSearch, loadDistributors]);

  // Filter + Search
  const processedData = useMemo(() => {
    let result = filterMarkets(data, filter);

    if (query.trim().length > 0) {
      result = result.filter((m) =>
        m.market.toLowerCase().includes(query.toLowerCase())
      );
    }

    return result;
  }, [data, filter, query]);

  const totalPages = Math.ceil(processedData.length / rowsPerPage);
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageRows = processedData.slice(start, end);
  const distributorAutocompleteOptions = useMemo(
    () => [{ value: "", label: "All Distributors" }, ...distributorOptions],
    [distributorOptions]
  );

  return (
    <ChartCard
      title="Market Performance Analysis"
      icon={DollarSign}
      iconColor="text-green-500"
      className="w-full"
    >
      {/* Filter + Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        {/* Dropdown */}
        <select
          className="select select-bordered w-full md:max-w-xs"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          {filterOptions.map((f) => (
            <option key={f}>{f}</option>
          ))}
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
          containerClassName="w-full md:max-w-xs [&_.label]:hidden"
        />
        {/* Search */}
        <input
          type="text"
          placeholder="Search locations..."
          className="input input-bordered w-full md:max-w-xs"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table w-full text-base-content">
          <thead>
            <tr className="border-b border-base-300 text-sm font-semibold">
              <th>Retails</th>
              <th>Consumers</th>
              <th>Purchases</th>
              <th>Conversion</th>
              <th>Demos</th>
              <th>Efficiency</th>
            </tr>
          </thead>

          <tbody>
            {pageRows.map((m) => (
              <tr
                key={m.market}
                className="hover:bg-base-200/40 transition-colors"
              >
                <td className="font-semibold">{m.market}</td>
                <td>{m.consumers.toLocaleString()}</td>
                <td>{m.purchases.toLocaleString()}</td>

                {/* Conversion Badge */}
                <td>
                  <span
                    className="px-3 py-1 rounded-full text-white text-sm font-semibold"
                    style={{
                      backgroundColor:
                        m.conversion >= 30
                          ? "#16a34a"
                          : m.conversion >= 20
                            ? "#60a5fa"
                            : "#9ca3af",
                    }}
                  >
                    {m.conversion}%
                  </span>
                </td>

                <td>{m.demos}</td>
                <td>{m.efficiency}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-base-content/70">
        <button
          className="btn btn-sm btn-outline"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>

        <span>
          Page <strong>{page}</strong> of {totalPages}
        </span>

        <button
          className="btn btn-sm btn-outline"
          disabled={page === totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>
    </ChartCard>
  );
});
