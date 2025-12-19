import { CalendarDays } from "lucide-react";
import type { QuarterSummary } from "@/data/dashboard-retail/quarterSummaryMock";

export default function QuarterSummaryCards({
  data,
}: {
  data: QuarterSummary[];
}) {
  return (
    <section className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {data.map((q, idx) => (
        <div
          key={idx}
          className={`
            p-5 rounded-xl shadow-md border ${q.border} ${q.color}
            flex flex-col gap-4 transition-all hover:shadow-lg
          `}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-base-content/80" />
              <span className="font-bold text-base-content">{q.quarter}</span>
            </div>

            <span className="text-xs px-2 py-1 rounded-full bg-base-100 border border-base-300">
              {q.months}
            </span>
          </div>

          {/* METRICS ROW */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white dark:bg-base-100 shadow-sm text-center">
              <span className="text-xs font-semibold text-base-content/60">
                CONSUMERS
              </span>
              <div className="text-xl font-bold text-base-content">
                {q.consumers.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-base-100 shadow-sm text-center">
              <span className="text-xs font-semibold text-base-content/60">
                PURCHASES
              </span>
              <div className="text-xl font-bold text-base-content">
                {q.purchases.toLocaleString()}
              </div>
            </div>
          </div>

          {/* CONVERSION RATE */}
          <div className="p-4 rounded-lg bg-white dark:bg-base-100 shadow-sm text-center">
            <span className="text-xs font-semibold text-base-content/60">
              CONVERSION RATE
            </span>

            <div className="text-2xl font-bold text-primary mt-1">
              {q.conversion}%
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
