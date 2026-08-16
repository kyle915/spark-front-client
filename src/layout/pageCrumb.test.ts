import { describe, expect, it } from "vitest";
import { looksLikeRouteId } from "./pageCrumb";

describe("looksLikeRouteId", () => {
  it("detects dashed UUIDs", () => {
    expect(looksLikeRouteId("01a0011e-437b-7f56-abcd-1234567890ab")).toBe(true);
  });

  it("detects compact hex ids from the topbar dump", () => {
    expect(looksLikeRouteId("01A0011E437B7F56ABCD1234567890AB")).toBe(true);
  });

  it("leaves human path segments alone", () => {
    expect(looksLikeRouteId("missing")).toBe(false);
    expect(looksLikeRouteId("list")).toBe(false);
    expect(looksLikeRouteId("dashboard")).toBe(false);
  });
});
