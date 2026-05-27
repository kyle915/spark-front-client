import { describe, it, expect } from "vitest";
import { parseLocaleNumber } from "./index";

/**
 * The recap forms persist these values, and a NaN here saved as null and
 * silently wiped fields like Account Spend (the reported "96,63" bug).
 * These cases pin the US/European disambiguation so a refactor can't
 * regress it.
 */
describe("parseLocaleNumber", () => {
  it("parses comma-decimal input (the reported case)", () => {
    expect(parseLocaleNumber("96,63")).toBe(96.63);
    expect(parseLocaleNumber("12,5")).toBe(12.5);
    expect(parseLocaleNumber("0,99")).toBe(0.99);
  });

  it("parses plain US decimals and integers unchanged", () => {
    expect(parseLocaleNumber("96.63")).toBe(96.63);
    expect(parseLocaleNumber("7")).toBe(7);
    expect(parseLocaleNumber("1234")).toBe(1234);
  });

  it("treats a lone comma + 3-digit tail as US thousands", () => {
    expect(parseLocaleNumber("1,234")).toBe(1234);
    expect(parseLocaleNumber("1,250")).toBe(1250);
    expect(parseLocaleNumber("12,345")).toBe(12345);
  });

  it("strips grouping when both separators are present", () => {
    expect(parseLocaleNumber("1,234.56")).toBe(1234.56); // US
    expect(parseLocaleNumber("1.234,56")).toBe(1234.56); // European
    expect(parseLocaleNumber("1,234,567")).toBe(1234567); // US grouping
    expect(parseLocaleNumber("1.234.567,89")).toBe(1234567.89); // European
  });

  it("handles currency symbols, spaces and signs", () => {
    expect(parseLocaleNumber("$96,63")).toBe(96.63);
    expect(parseLocaleNumber(" 96,63 ")).toBe(96.63);
    expect(parseLocaleNumber("-96,63")).toBe(-96.63);
  });

  it("returns null for blank or unparseable input", () => {
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber("   ")).toBeNull();
    expect(parseLocaleNumber("-")).toBeNull();
    expect(parseLocaleNumber(null)).toBeNull();
    expect(parseLocaleNumber(undefined)).toBeNull();
    expect(parseLocaleNumber("abc")).toBeNull();
  });
});
