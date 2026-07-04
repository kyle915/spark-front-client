import { useState } from "react";
import type { DateRange } from "react-day-picker";
import Layout from "@/layout/Layout";
import { MetricCard } from "../../cards/metric-card";
import FiltersPanel from "../../filters/FiltersPanel";
import ChartCard from "../../charts/ChartCard";

import {
  Users,
  ShoppingCart,
  Target,
  BarChart3,
  UserPlus,
  CalendarDays,
  CalendarClockIcon,
} from "lucide-react";

// Analytics charts (Events)
import EventsByTypeChart from "@/components/charts/EventsByTypeChart";
import EventsByStatusChart from "@/components/charts/EventsByStatusChart";
import EventsByDateChart from "@/components/charts/EventsByDateChart";

// Analytics charts (Requests)
import RequestsByTypeChart from "@/components/charts/RequestsByTypeChart";
import RequestsByStatusChart from "@/components/charts/RequestsByStatusChart";
import RequestsByClientChart from "@/components/charts/RequestsByClientChart";

// Hooks
import { useDashboardData } from "@/hooks/useDashboardData";
import { useEventsAnalytics } from "@/hooks/useEventsAnalytics";
import { useRequestsAnalytics } from "@/hooks/useRequestsAnalytics";
import type { RequestRow, NamedEntity } from "@/types/columnsTypes";

export default function DashboardIndex() {
  const { metrics: gqlMetrics, events, requests } = useDashboardData();

  // Date-range filter from the FiltersPanel. Filters the already-loaded
  // events/requests client-side (all analytics derive from these arrays);
  // undefined = no filter, show everything loaded.
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const fromMs = dateRange?.from
    ? new Date(
        dateRange.from.getFullYear(),
        dateRange.from.getMonth(),
        dateRange.from.getDate(),
      ).getTime()
    : null;
  const toMs = dateRange?.to
    ? new Date(
        dateRange.to.getFullYear(),
        dateRange.to.getMonth(),
        dateRange.to.getDate(),
        23, 59, 59, 999,
      ).getTime()
    : null;
  const rangeActive = fromMs !== null || toMs !== null;
  const inRange = (dateStr?: string | null): boolean => {
    if (!rangeActive) return true;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return false;
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t > toMs) return false;
    return true;
  };

  const filteredEvents = (events ?? []).filter((e) =>
    inRange((e as { date?: string | null }).date),
  );
  const eventsAnalytics = useEventsAnalytics(filteredEvents);
  const mapEntity = (
    entity?: { id?: string; uuid?: string | null; name?: string | null } | null
  ): NamedEntity | null => {
    if (!entity) return null;
    return {
      id: entity.id ?? entity.name ?? "unknown",
      uuid: entity.uuid ?? null,
      name: entity.name ?? "Unknown",
    };
  };

  type RequestLike = Partial<RequestRow> & { id: string };

  const requestRows: RequestRow[] = (requests ?? []).map((r) => {
    const req = r as RequestLike;
    return {
      id: req.id,
      uuid: req.uuid ?? req.id,
      name: req.name ?? "Unknown",
      date: req.date ?? null,
      client: mapEntity(req.client),
      distributor: mapEntity(req.distributor),
      retailer: mapEntity(req.retailer),
      requestType: mapEntity(req.requestType),
      status: mapEntity(req.status),
      startTime: req.startTime ?? null,
      address: req.address ?? null,
    };
  });
  const filteredRequestRows = requestRows.filter((r) => inRange(r.date));
  const requestsAnalytics = useRequestsAnalytics(filteredRequestRows);

  // When a range is active the top-line cards reflect the filtered set;
  // otherwise the server's all-time totals.
  const displayMetrics = rangeActive
    ? {
        totalEvents: filteredEvents.length,
        totalRequests: filteredRequestRows.length,
      }
    : gqlMetrics;
  const fmtDay = (d?: Date) =>
    d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "…";

  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-5">
        {/* HEADER */}
        <div className="flex items-center justify-center text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-5">
            Performance Analytics Dashboard
          </h1>
        </div>

        {/* FILTERS */}
        <FiltersPanel
          onApplyFilters={(filters) => {
            // FiltersPanel emits yyyy-MM-dd strings; parse as LOCAL dates
            // (new Date("yyyy-MM-dd") is UTC midnight → off-by-one in the US).
            const parse = (s?: string | null): Date | undefined => {
              if (!s) return undefined;
              const [y, m, d] = s.split("-").map(Number);
              return new Date(y, m - 1, d);
            };
            const from = parse(filters.startDate);
            const to = parse(filters.endDate);
            setDateRange(from || to ? { from, to } : undefined);
          }}
        />

        {rangeActive && (
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Showing {fmtDay(dateRange?.from)} – {fmtDay(dateRange?.to)} ·{" "}
              {filteredEvents.length} events, {filteredRequestRows.length} requests
            </span>
            <button
              onClick={() => setDateRange(undefined)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 underline"
            >
              Clear dates
            </button>
          </div>
        )}

        {/* METRICS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
          {Object.entries(displayMetrics).map(([key, value]) => (
            <MetricCard
              key={key}
              metricKey={key}
              title={key.replace(/([A-Z])/g, " $1")}
              value={String(value)}
              change="5%"
              variant="success"
              icon={<CalendarClockIcon className="text-blue-600" />}
            />
          ))}
        </section>

        {/* AI Insights
        <AiInsightsSection insights={insights} isLoading={false} /> */}

        {/* MONTHLY PERFORMANCE
        <ChartCard title="Monthly Performance Trends" icon={CalendarDays} iconColor="text-blue-600">
          <MarketPerformanceChart data={marketPerformance} />
        </ChartCard> */}

        {/* RMM PERFORMANCE */}
        {/* <ChartCard title="RMM Performance" icon={UserPlus} iconColor="text-red-500">
          <RMMPerformanceChart data={rmmData} />
        </ChartCard> */}

        {/* <section className="mt-10 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Retail Accounts Performance" icon={ShoppingCart} iconColor="text-amber-600">
            <RetailAccountsChart data={retailAccounts} />
          </ChartCard>

          <ChartCard title="Consumer Reach vs Conversion" icon={Users} iconColor="text-orange-500">
            <MarketPerformanceChart data={marketPerformance} />
          </ChartCard>
        </section> */}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Events by Type"
            icon={BarChart3}
            iconColor="text-blue-600"
          >
            <EventsByTypeChart analytics={eventsAnalytics.types} />
          </ChartCard>

          <ChartCard
            title="Events by Status"
            icon={Target}
            iconColor="text-purple-600"
          >
            <EventsByStatusChart analytics={eventsAnalytics.statuses} />
          </ChartCard>
        </section>

        <section className="mt-6">
          <ChartCard
            title="Events Timeline"
            icon={CalendarDays}
            iconColor="text-amber-600"
          >
            <EventsByDateChart analytics={eventsAnalytics.dates} />
          </ChartCard>
        </section>

        {/* REQUEST ANALYTICS */}
        <h2 className="text-2xl font-bold mt-14 mb-4 dark:text-white">
          Request Analytics
        </h2>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Requests by Type"
            icon={ShoppingCart}
            iconColor="text-orange-600"
          >
            <RequestsByTypeChart analytics={requestsAnalytics.types} />
          </ChartCard>

          <ChartCard
            title="Requests by Status"
            icon={Users}
            iconColor="text-red-500"
          >
            <RequestsByStatusChart analytics={requestsAnalytics.statuses} />
          </ChartCard>
        </section>

        <section className="mt-6">
          <ChartCard
            title="Requests by Client"
            icon={UserPlus}
            iconColor="text-green-500"
          >
            <RequestsByClientChart analytics={requestsAnalytics.clients} />
          </ChartCard>
        </section>
      </main>
    </Layout>
  );
}
