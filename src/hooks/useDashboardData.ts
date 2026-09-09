/**
 * Legacy dashboard data hook — retired.
 *
 * Home now routes to DashboardEvent → Insights. The old hardcoded
 * consumers/awareness/% metrics must never surface again.
 */
export function useDashboardData(): never {
  throw new Error(
    "useDashboardData is retired. Use Dashboard (/) program performance section.",
  );
}
