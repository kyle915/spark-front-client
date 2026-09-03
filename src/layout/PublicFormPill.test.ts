import { describe, expect, it } from "vitest";
import { publicFormCtaLabel } from "./PublicFormPill";

describe("publicFormCtaLabel", () => {
  it("labels spark-form links as External request link", () => {
    expect(publicFormCtaLabel("spark-form")).toBe("External request link");
    expect(publicFormCtaLabel(undefined)).toBe("External request link");
    expect(publicFormCtaLabel(null)).toBe("External request link");
  });

  it("labels check-in-only tenants as Public check-in link", () => {
    expect(publicFormCtaLabel("checkin")).toBe("Public check-in link");
  });
});
