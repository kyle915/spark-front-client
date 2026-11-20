import { fmtTimeInZone } from "@/utils/venueDay";

/** One shift on the time-sheet export. Mirrors PayrollTimesheetExportQuery. */
export type TimesheetShift = {
  readonly ambassadorName?: string | null;
  readonly ambassadorPhone?: string | null;
  readonly date?: string | null;
  readonly tenantName?: string | null;
  readonly address?: string | null;
  readonly clockInAt?: string | null;
  readonly clockOutAt?: string | null;
  readonly timeZone?: string | null;
  readonly onTheClock?: boolean | null;
  readonly hours?: number | null;
  readonly estimated?: boolean | null;
};

export const TIMESHEET_CSV_HEADER = [
  "Name",
  "Phone",
  "Date",
  "Location",
  "Clock in",
  "Clock out",
  "Hours",
  "Time zone",
  "Client",
];

const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
const time = (iso: string | null | undefined, tz: string | null | undefined) =>
  iso ? fmtTimeInZone(iso, tz) : "";

/** Per-shift time sheet as CSV text. Punch times are on the venue's clock. */
export function timesheetCsv(rows: readonly TimesheetShift[]): string {
  const lines = [TIMESHEET_CSV_HEADER.map(esc).join(",")];
  for (const r of rows) {
    lines.push(
      [
        esc(r.ambassadorName || ""),
        esc(r.ambassadorPhone || ""),
        esc(r.date || ""),
        esc(r.address || ""),
        esc(time(r.clockInAt, r.timeZone)),
        esc(r.onTheClock ? "Still on the clock" : time(r.clockOutAt, r.timeZone)),
        typeof r.hours === "number" ? r.hours.toFixed(2) : "",
        esc(r.timeZone || ""),
        esc(r.tenantName || ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}
