import { describe, expect, it } from "vitest";
import { documentTitleFor, humanizeSegment, routeTitleFor } from "./routeTitles";

describe("routeTitleFor", () => {
  it("names list pages properly", () => {
    expect(routeTitleFor("/recaps/list")).toEqual({ parent: "Recaps", title: "Recaps" });
    expect(routeTitleFor("/live-board")?.title).toBe("On the Clock");
    expect(routeTitleFor("/schedule/")?.title).toBe("Staffing Board");
  });
  it("uses client wording for brand users", () => {
    expect(routeTitleFor("/requests/list", { isClient: true })?.title).toBe("My Requests");
    expect(routeTitleFor("/recaps/list", { isClient: true })?.title).toBe("My Recaps");
  });
  it("returns null for unknown routes", () => {
    expect(routeTitleFor("/nope")).toBeNull();
  });
});

describe("helpers", () => {
  it("humanizes segments", () => {
    expect(humanizeSegment("field-sampling-report")).toBe("Field Sampling Report");
  });
  it("builds tab titles", () => {
    expect(documentTitleFor("Recaps")).toBe("Recaps · Spark");
    expect(documentTitleFor("")).toBe("Spark by Ignite");
  });
});
