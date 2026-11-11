import { describe, expect, it } from "vitest";
import { activityActor, activityKindLabel, activityWhen } from "./activityLabels";

describe("activityKindLabel", () => {
  it("uses plain labels for known kinds", () => {
    expect(activityKindLabel("status_changed")).toBe("Status changed");
    expect(activityKindLabel("BA_INVITED")).toBe("Ambassador invited");
    expect(activityKindLabel("attendance_adjusted")).toBe("Clock time adjusted");
  });
  it("makes unknown kinds readable", () => {
    expect(activityKindLabel("plan_attached")).toBe("Plan attached");
    expect(activityKindLabel("")).toBe("Activity");
  });
});

describe("activityActor", () => {
  it("prefers the name, then the email's local part, then system", () => {
    expect(activityActor("Nena R", "n@x.co")).toBe("Nena R");
    expect(activityActor("", "ops@ignite.co")).toBe("ops");
    expect(activityActor(null, null)).toBe("Spark (automatic)");
  });
});

describe("activityWhen", () => {
  it("is empty for bad input", () => {
    expect(activityWhen("nope")).toBe("");
    expect(activityWhen(null)).toBe("");
  });
  it("adds the year only when it differs", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(activityWhen("2026-11-08T15:00:00Z", now)).not.toMatch(/2026/);
    expect(activityWhen("2025-11-08T15:00:00Z", now)).toMatch(/2025/);
  });
});
