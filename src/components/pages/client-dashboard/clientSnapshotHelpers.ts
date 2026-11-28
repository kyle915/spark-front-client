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
  upcomingEndDate: string;
}

const fmtYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
    upcomingEndDate: fmtYmd(upcomingEnd),
  };
}
