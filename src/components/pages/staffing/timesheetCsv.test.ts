import { describe, expect, it } from "vitest";
import { TIMESHEET_CSV_HEADER, timesheetCsv } from "./timesheetCsv";

describe("timesheetCsv", () => {
  it("has the time-sheet columns, calling the place a location", () => {
    expect(TIMESHEET_CSV_HEADER.slice(0, 7)).toEqual([
      "Name",
      "Phone",
      "Date",
      "Location",
      "Clock in",
      "Clock out",
      "Hours",
    ]);
    expect(TIMESHEET_CSV_HEADER.join(" ").toLowerCase()).not.toContain("store");
  });
  it("writes one line per shift with venue-clock times", () => {
    const csv = timesheetCsv([
      {
        ambassadorName: "Test Worker",
        ambassadorPhone: "(555) 010-0142",
        date: "2026-11-19",
        address: "100 Example Ave, Springfield, IL",
        clockInAt: "2026-11-19T15:00:00Z",
        clockOutAt: "2026-11-19T19:30:00Z",
        timeZone: "America/Chicago",
        hours: 4.5,
        tenantName: "Example Client",
      },
    ]);
    const [, line] = csv.split("\n");
    expect(line).toContain('"Test Worker","(555) 010-0142","2026-11-19","100 Example Ave, Springfield, IL"');
    expect(line).toContain('"9:00 AM"');
    expect(line).toContain('"1:30 PM"');
    expect(line).toContain("4.50");
  });
  it("marks a shift that's still open", () => {
    const csv = timesheetCsv([{ ambassadorName: "A", clockInAt: "2026-11-19T15:00:00Z", onTheClock: true }]);
    expect(csv).toContain("Still on the clock");
  });
});
