import { describe, expect, it } from "vitest";
import { publicFormCtaLabel } from "./PublicFormPill";

describe("publicFormCtaLabel", () => {
  it("labels spark-form links as Submit Event Request", () => {
    expect(publicFormCtaLabel("spark-form")).toBe("Submit Event Request");
    expect(publicFormCtaLabel(undefined)).toBe("Submit Event Request");
    expect(publicFormCtaLabel(null)).toBe("Submit Event Request");
  });

  it("labels check-in-only tenants as Open check-in", () => {
    expect(publicFormCtaLabel("checkin")).toBe("Open check-in");
  });
});
