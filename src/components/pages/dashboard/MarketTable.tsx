import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
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

  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterType === "top-efficiency")
      d = d.sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);
    if (filterType === "top-conversion")
      d = d.sort((a, b) => b.conversion - a.conversion).slice(0, 10);
    if (filterType === "top-purchases")
      d = d.sort((a, b) => b.purchases - a.purchases).slice(0, 10);
    return d.filter((m) =>
      m.market.toLowerCase().includes(globalFilter.toLowerCase())
    );
  }, [data, filterType, globalFilter]);

  const columns = useMemo<ColumnDef<MarketData>[]>(
    () => [
      { accessorKey: "market", header: "Market" },
      { accessorKey: "consumers", header: "Consumers" },
      { accessorKey: "purchases", header: "Purchases" },
      {
        accessorKey: "conversion",
        header: "Conversion",
        cell: (info) => {
          const v = info.getValue<number>();
          const color =
            v >= 25
              ? "badge-success"
              : v >= 20
                ? "badge-info"
                : "badge-ghost";
          return (
            <span className={`badge ${color} font-semibold`}>{v}%</span>
          );
        },
      },
      { accessorKey: "demos", header: "Demos" },
      {
        accessorKey: "efficiency",
        header: "Efficiency",
        cell: (info) => `${info.getValue<number>()}%`,
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-gray-100 dark:bg-gray-700">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: <ArrowUp size={12} />,
                        desc: <ArrowDown size={12} />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-2 px-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <button
          className="btn btn-outline btn-sm rounded-full"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <span className="text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <button
          className="btn btn-outline btn-sm rounded-full"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  );
}
