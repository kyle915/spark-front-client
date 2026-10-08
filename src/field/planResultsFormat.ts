import type { PlanResultRecap } from "./planResultsApi";

export function fmtMetricValue(value: number | null, unit: string): string {
  if (value == null) return "—";
  if (unit === "$") {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (unit === "h" || unit === "mi") {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
  }
  return Math.round(value).toLocaleString();
}

/** Whole-percent of plan, or null when there's nothing to compare. */
export function pctOfPlan(
  planned: number | null,
  actual: number | null,
): number | null {
  if (planned == null || planned <= 0 || actual == null) return null;
  return Math.round((actual / planned) * 100);
}

export function recapStatusLabel(status: PlanResultRecap["status"]): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "needs_review":
      return "Needs review · not in totals";
    case "archived":
      return "Archived · not in totals";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function planDateLabel(startsOn: string, days: number): string {
  const [y, m, d] = startsOn.split("-").map(Number);
  if (!y || !m || !d) return startsOn;
  const start = new Date(y, m - 1, d);
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (days <= 1) return fmt(start);
  const end = new Date(y, m - 1, d + days - 1);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function resultsBadge(counted: number, pending: number): string | null {
  if (counted > 0 && pending > 0) return `Results in · ${counted} + ${pending} in review`;
  if (counted > 0) return `Results in · ${counted}`;
  if (pending > 0) return `${pending} in review`;
  return null;
}
