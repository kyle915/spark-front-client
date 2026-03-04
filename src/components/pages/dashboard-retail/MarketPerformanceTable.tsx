import { memo, useMemo, useState } from "react";
import { DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import ChartCard from "@/components/charts/ChartCard";
import FormAutocomplete from "@/shared/FormAutocomplete";
import { useGlobalDistributors } from "../hooks/useGlobalDistributors";

type MarketRow = {
  market: string;
  consumers: number;
  purchases: number;
  conversion: number;
  demos: number;
  efficiency: number;
  distributorId: string;
};

const filterOptions = [
  "All Retails",
  "Top 10 by Efficiency",
  "Top 10 by Conversion",
  "Top 10 by Purchases",
] as const;

type DistributorFilterValues = {
  distributor: string | null;
};

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
}: {
  data: MarketRow[];
  rowsPerPage?: number;
}) {
  const [filter, setFilter] = useState<string>("All Retails");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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

  const processedData = useMemo(() => {
    let result = filterMarkets(data, filter);

    // 🔥 Distributor LOCAL filter
    if (selectedDistributorValue) {
      result = result.filter(
        (m) => m.distributorId === selectedDistributorValue,
      );
    }

    if (query.trim().length > 0) {
      result = result.filter((m) =>
        m.market.toLowerCase().includes(query.toLowerCase()),
      );
    }

    return result;
  }, [data, filter, query, selectedDistributorValue]);

  const totalPages = Math.ceil(processedData.length / rowsPerPage);
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageRows = processedData.slice(start, end);

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
          options={[{ value: "", label: "All Distributors" }, ...distributors]}
          loading={loading}
          placeholder={loading ? "Loading..." : "Search distributor..."}
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
          Page <strong>{page}</strong> of {totalPages || 1}
        </span>

        <button
          className="btn btn-sm btn-outline"
          disabled={page === totalPages || totalPages === 0}
          onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
        >
          Next
        </button>
      </div>
    </ChartCard>
  );
});
