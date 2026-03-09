import { memo, useState } from "react";
import { MapPin } from "lucide-react";
import ChartCard from "@/components/charts/ChartCard";

type RegionRow = {
  rm: string;
  events: number;
  consumers: number;
  engaged: number;
  willing: number;
  intent: number;
};

export default memo(function RegionalMarketPerformance({
  data,
  rowsPerPage = 7,
}: {
  data: RegionRow[];
  rowsPerPage?: number;
}) {
  const [page, setPage] = useState(1);
  const hasData = data.length > 0;

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageRows = data.slice(start, end);

  return (
    <ChartCard
      title="Regional Market Performance"
      icon={MapPin}
      iconColor="text-red-500"
      className="w-full"
      fixedHeight
    >
      {!hasData ? (
        <div className="rounded-xl border border-dashed border-base-300 bg-base-200/50 p-6 text-center text-base-content/70">
          No data available.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table w-full text-base-content">
              <thead>
                <tr className="border-b border-base-300 text-sm font-semibold">
                  <th>RM</th>
                  <th>Events</th>
                  <th>Consumers</th>
                  <th>Engaged Consumers</th>
                  <th>Willing to Purchase</th>
                  <th>Intent</th>
                </tr>
              </thead>

              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.rm} className="hover:bg-base-200/40 transition-colors">
                    <td>{r.rm}</td>
                    <td>{r.events}</td>
                    <td>{r.consumers.toLocaleString()}</td>
                    <td>{r.engaged.toLocaleString()}</td>
                    <td>{r.willing.toLocaleString()}</td>
                    <td>
                      <span
                        className="px-3 py-1 rounded-full text-white text-sm font-semibold"
                        style={{
                          backgroundColor:
                            r.intent >= 75
                              ? "#16a34a" // green-600
                              : r.intent >= 65
                                ? "#22c55e" // green-500
                                : "#84cc16", // lime-500
                        }}
                      >
                        {r.intent}%
                      </span>
                    </td>
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
        </>
      )}
    </ChartCard>
  );
});
