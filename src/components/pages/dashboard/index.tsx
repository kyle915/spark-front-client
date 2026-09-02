/**
 * Legacy ops dashboard — retired.
 *
 * `/` renders DashboardEvent; analytics live on `/insights`. This module
 * stays only so stale imports fail loudly instead of inventing KPIs.
 */
export default function DashboardIndex() {
  throw new Error(
    "Legacy dashboard/index is retired. Navigate to / or /insights.",
  );
}
