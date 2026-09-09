/**
 * Legacy ops dashboard — retired.
 *
 * `/` is DashboardEvent (ops pulse + program performance).
 * `/insights` redirects there. This module stays only so stale
 * imports fail loudly instead of inventing KPIs.
 */
export default function DashboardIndex() {
  throw new Error(
    "Legacy dashboard/index is retired. Navigate to / (Dashboard).",
  );
}
