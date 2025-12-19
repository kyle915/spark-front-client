import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BadgeDollarSign } from "lucide-react";

export interface MarketData {
  market: string;
  consumers: number;
  purchases: number;
  conversion: number;
  demos: number;
  efficiency: number;
}

interface Props {
  data: MarketData[];
}

export function MarketTable({ data }: Props) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [filterType, setFilterType] = useState("none");
  const [sortKey, setSortKey] = useState<keyof MarketData>("market");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredData = useMemo(() => {
    let d = [...data];
    const sortBy = (key: keyof MarketData) => {
      d = d.sort((a, b) => {
        const first = a[key];
        const second = b[key];
        if (typeof first === "number" && typeof second === "number") {
          return sortDir === "asc" ? first - second : second - first;
        }
        return sortDir === "asc"
          ? String(first).localeCompare(String(second))
          : String(second).localeCompare(String(first));
      });
    };

    if (filterType === "top-efficiency")
      d = d.sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);
    if (filterType === "top-conversion")
      d = d.sort((a, b) => b.conversion - a.conversion).slice(0, 10);
    if (filterType === "top-purchases")
      d = d.sort((a, b) => b.purchases - a.purchases).slice(0, 10);

    sortBy(sortKey);
    return d.filter((m) =>
      m.market.toLowerCase().includes(globalFilter.toLowerCase())
    );
  }, [data, filterType, globalFilter, sortDir, sortKey]);

  const toggleSort = (key: keyof MarketData) => {
    setSortKey(key);
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const sortIcon = (key: keyof MarketData) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BadgeDollarSign className="text-green-600" size={28} />
        <h2 className="text-xl md:text-2xl font-bold">
          Market Performance Analysis
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
        <select
          className="select select-bordered w-full sm:w-1/3"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="none">All Markets</option>
          <option value="top-efficiency">Top 10 by Efficiency</option>
          <option value="top-conversion">Top 10 by Conversion</option>
          <option value="top-purchases">Top 10 by Purchases</option>
        </select>
        <input
          type="text"
          placeholder="Search markets..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="input input-bordered w-full sm:w-1/3"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th
                onClick={() => toggleSort("market")}
                className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200"
              >
                <div className="flex items-center gap-1">
                  Market {sortIcon("market")}
                </div>
              </th>
              <th
                onClick={() => toggleSort("consumers")}
                className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200"
              >
                <div className="flex items-center gap-1">
                  Consumers {sortIcon("consumers")}
                </div>
              </th>
              <th
                onClick={() => toggleSort("purchases")}
                className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200"
              >
                <div className="flex items-center gap-1">
                  Purchases {sortIcon("purchases")}
                </div>
              </th>
              <th
                onClick={() => toggleSort("conversion")}
                className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200"
              >
                <div className="flex items-center gap-1">
                  Conversion {sortIcon("conversion")}
                </div>
              </th>
              <th
                onClick={() => toggleSort("demos")}
                className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200"
              >
                <div className="flex items-center gap-1">
                  Demos {sortIcon("demos")}
                </div>
              </th>
              <th
                onClick={() => toggleSort("efficiency")}
                className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200"
              >
                <div className="flex items-center gap-1">
                  Efficiency {sortIcon("efficiency")}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => (
              <tr
                key={row.market}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="py-2 px-3">{row.market}</td>
                <td className="py-2 px-3">{row.consumers}</td>
                <td className="py-2 px-3">{row.purchases}</td>
                <td className="py-2 px-3">
                  <span
                    className={`badge ${
                      row.conversion >= 25
                        ? "badge-success"
                        : row.conversion >= 20
                          ? "badge-info"
                          : "badge-ghost"
                    } font-semibold`}
                  >
                    {row.conversion}%
                  </span>
                </td>
                <td className="py-2 px-3">{row.demos}</td>
                <td className="py-2 px-3">{row.efficiency}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
