import { describe, expect, it } from "vitest";
import {
  isUsableApiImage,
  officialFallbackSrc,
  tenantInitials,
  tenantLogoCandidates,
} from "./tenantLogo";

describe("isUsableApiImage", () => {
  it("rejects empty and the Liquid Death wordmark that vanishes at 20px", () => {
    expect(isUsableApiImage(null)).toBe(false);
    expect(isUsableApiImage("")).toBe(false);
    expect(
      isUsableApiImage(
        "https://storage.googleapis.com/sparkio-production/tenants/1768336651834_logo.svg",
      ),
    ).toBe(false);
  });

  it("accepts a real tenant image URL", () => {
    expect(
      isUsableApiImage(
        "https://storage.googleapis.com/sparkio-production/tenants/images/019e52fc-07f5-7702-9353-17a17a3e6148-logo.png",
      ),
    ).toBe(true);
  });
});

describe("officialFallbackSrc", () => {
  it("maps Liquid Death by name and by ighn slug", () => {
    const byName = officialFallbackSrc({ name: "Liquid Death" });
    const bySlug = officialFallbackSrc({
      requestUrlName: "ighn-liquid-death",
    });
    expect(byName).toContain("Liquid-Death-Logo.svg");
    expect(bySlug).toBe(byName);
  });

  it("maps Torch THC from the keee slug", () => {
    expect(
      officialFallbackSrc({ requestUrlName: "keee-torch-thc" }),
    ).toContain("TorchLogo");
  });

  it("returns null when we have no official file", () => {
    expect(officialFallbackSrc({ name: "Resort Beverage" })).toBeNull();
  });
});

describe("tenantLogoCandidates", () => {
  it("prefers a usable API image over the official fallback", () => {
    const api =
      "https://storage.googleapis.com/sparkio-production/tenants/images/girl-beer.png";
    expect(
      tenantLogoCandidates({ name: "Girl Beer", image: api }),
    ).toEqual([api]);
  });

  it("skips the unusable Liquid Death API wordmark and uses the official mark", () => {
    const candidates = tenantLogoCandidates({
      name: "Liquid Death",
      requestUrlName: "ighn-liquid-death",
      image:
        "https://storage.googleapis.com/sparkio-production/tenants/1768336651834_logo.svg",
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toContain("Liquid-Death-Logo.svg");
  });

  it("uses the official mark when the API image is empty", () => {
    const candidates = tenantLogoCandidates({
      name: "Neutonic",
      image: null,
    });
    expect(candidates[0]).toContain("neutonic.com");
  });
});

describe("tenantInitials", () => {
  it("uses the first two words when present", () => {
    expect(tenantInitials("Torch THC")).toBe("TT");
    expect(tenantInitials("Stone House Bread")).toBe("SH");
  });

  it("falls back to the first two letters of a single word", () => {
    expect(tenantInitials("Neutonic")).toBe("NE");
  });
});
