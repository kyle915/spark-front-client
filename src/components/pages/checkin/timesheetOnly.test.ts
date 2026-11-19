import { describe, expect, it } from "vitest";
import { timesheetIdentifyBody, timesheetIdentifyError, workedHours } from "./timesheetOnly";

const base = {
  firstName: "Test",
  lastName: "Worker",
  phone: "(555) 010-0142",
  location: "100 Example Ave, Springfield, IL",
  today: "2026-11-19",
};

describe("timesheet-only identify", () => {
  it("needs name, phone and location", () => {
    expect(timesheetIdentifyError(base)).toBeNull();
    expect(timesheetIdentifyError({ ...base, firstName: " " })).toMatch(/first name/);
    expect(timesheetIdentifyError({ ...base, lastName: "" })).toMatch(/last name/);
    expect(timesheetIdentifyError({ ...base, phone: "555" })).toMatch(/phone/);
    expect(timesheetIdentifyError({ ...base, location: "" })).toMatch(/location/);
  });
  it("only asks for a program when there are several", () => {
    expect(timesheetIdentifyError({ ...base, needsProgram: true })).toMatch(/working/);
    expect(timesheetIdentifyError({ ...base, needsProgram: true, eventTypeId: "4" })).toBeNull();
  });
  it("sends the location as the address and never a store name", () => {
    const body = timesheetIdentifyBody(base);
    expect(body).toEqual({
      firstName: "Test",
      lastName: "Worker",
      phone: "(555) 010-0142",
      eventDate: "2026-11-19",
      address: "100 Example Ave, Springfield, IL",
    });
    expect(body).not.toHaveProperty("storeName");
    expect(timesheetIdentifyBody({ ...base, needsProgram: true, eventTypeId: "4" })).toMatchObject({
      eventTypeId: "4",
    });
  });
  it("works out hours from the punches", () => {
    expect(workedHours("2026-11-19T15:00:00Z", "2026-11-19T19:30:00Z")).toBe(4.5);
    expect(workedHours("2026-11-19T15:00:00Z", null)).toBeNull();
  });
});
