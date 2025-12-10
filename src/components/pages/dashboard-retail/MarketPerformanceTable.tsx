import { memo, useState, useMemo } from "react";
import { DollarSign } from "lucide-react";
import ChartCard from "@/components/charts/ChartCard";

type MarketRow = {
  market: string;
  consumers: number;
  purchases: number;
  conversion: number;
  demos: number;
  efficiency: number;
};

const filterOptions = [
  "All Markets",
  "Top 10 by Efficiency",
  "Top 10 by Conversion",
  "Top 10 by Purchases",
] as const;

const filterDistributor = [
  "All Distributor",
  "Straub",
  "John Lenore",
  "Nev Bev",
  "AB1 Sylmar"
] as const;

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
  const [filter, setFilter] = useState<string>("All Markets");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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
        <select
          className="select select-bordered w-full md:max-w-xs"
          value={filterDistributor}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          {filterDistributor.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        {/* Search */}
        <input
          type="text"
          placeholder="Search markets..."
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
              <th>Market</th>
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
