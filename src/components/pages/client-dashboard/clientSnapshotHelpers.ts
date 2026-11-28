import { computePriorDateWindow } from "@/components/pages/reports/programReportHelpers";

export type ClientSnapshotHorizon = "30d" | "90d" | "ytd";

export const SNAPSHOT_HORIZON_OPTIONS: ReadonlyArray<{
  key: ClientSnapshotHorizon;
  label: string;
}> = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "ytd", label: "YTD" },
];

export interface SnapshotHorizonWindow {
  startDate: string;
  endDate: string;
  priorStart: string;
  priorEnd: string;
  spanDays: number;
  heading: string;
  priorLabel: string;
  priorRangeDisplay: string;
  upcomingEndDate: string;
}

const fmtYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtShortCalendarSpan = (startYmd: string, endYmd: string): string => {
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return "";
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  const sameYear = sy === ey;
  const sStr = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const eStr = e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${sStr} – ${eStr}`;
};

export function computeSnapshotHorizon(
  horizon: ClientSnapshotHorizon,
  now: Date = new Date(),
): SnapshotHorizonWindow {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  let heading: string;

  if (horizon === "ytd") {
    start = new Date(end.getFullYear(), 0, 1);
    heading = "Year to date";
  } else {
    const days = horizon === "90d" ? 90 : 30;
    start = new Date(end);
    start.setDate(end.getDate() - days);
    heading = `Last ${days} days`;
  }

  const startDate = fmtYmd(start);
  const endDate = fmtYmd(end);
  const prior = computePriorDateWindow(startDate, endDate);

  const upcomingEnd = new Date(end);
  upcomingEnd.setDate(end.getDate() + 90);

  if (!prior) {
    return {
      startDate,
      endDate,
      priorStart: startDate,
      priorEnd: startDate,
      spanDays: 30,
      heading,
      priorLabel: "prior window",
      priorRangeDisplay: "",
      upcomingEndDate: fmtYmd(upcomingEnd),
    };
  }

  return {
    startDate,
    endDate,
    priorStart: prior.startDate,
    priorEnd: prior.endDate,
    spanDays: prior.spanDays,
    heading,
    priorLabel:
      horizon === "ytd" ? `prior ${prior.spanDays}d` : `prior ${horizon}`,
    priorRangeDisplay: fmtShortCalendarSpan(prior.startDate, prior.endDate),
    upcomingEndDate: fmtYmd(upcomingEnd),
  };
}

export function formatPriorCount(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return `prior ${Math.round(value).toLocaleString("en-US")}`;
}

export function formatPriorRate(pct: number | null | undefined): string | null {
  if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0) {
    return null;
  }
  const rounded = Math.round(pct * 10) / 10;
  const formatted = Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
  return `prior ${formatted}`;
}
