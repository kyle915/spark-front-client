import { describe, expect, it } from "vitest";
import {
  isUsableApiImage,
  officialFallbackSrc,
  shortTenantName,
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

  it("maps Krispy Krunchy Chicken by name and slug", () => {
    const byName = officialFallbackSrc({ name: "Krispy Krunchy Chicken" });
    const bySlug = officialFallbackSrc({
      tenantSlug: "krispy-krunchy-chicken",
    });
    expect(byName).toContain("Krispy_Krunchy_Chicken_logo.jpg");
    expect(bySlug).toBe(byName);
  });

  it("maps Luckin Coffee and Grub Hub by name and slug", () => {
    expect(officialFallbackSrc({ name: "Luckin Coffee" })).toBe(
      "/brands/luckin-coffee-logo.png",
    );
    expect(officialFallbackSrc({ tenantSlug: "luckin-coffee" })).toBe(
      "/brands/luckin-coffee-logo.png",
    );
    expect(officialFallbackSrc({ name: "Grub Hub" })).toContain(
      "Grubhub_2025_logo.svg",
    );
    expect(officialFallbackSrc({ tenantSlug: "grub-hub" })).toContain(
      "Grubhub_2025_logo.svg",
    );
  });

  it("maps Anthropic by name and slug to the Claude symbol", () => {
    const byName = officialFallbackSrc({ name: "Anthropic" });
    const bySlug = officialFallbackSrc({ tenantSlug: "anthropic" });
    expect(byName).toContain("Claude_AI_symbol.svg");
    expect(bySlug).toBe(byName);
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

  it("prefers logoUrl over image when both are set", () => {
    const logoUrl =
      "https://storage.googleapis.com/sparkio-production/tenants/images/logo-url.png";
    const image =
      "https://storage.googleapis.com/sparkio-production/tenants/images/image.png";
    expect(
      tenantLogoCandidates({ name: "Girl Beer", image, logoUrl }),
    ).toEqual([logoUrl]);
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

  it("gives the Torch spark-form slug a real mark without an API image", () => {
    const candidates = tenantLogoCandidates({
      name: "Torch THC",
      requestUrlName: "keee-torch-thc",
      image: null,
    });
    expect(candidates[0]).toContain("TorchLogo");
  });

  it("gives Krispy Krunchy Chicken the official barn mark without an API image", () => {
    const candidates = tenantLogoCandidates({
      name: "Krispy Krunchy Chicken",
      tenantSlug: "krispy-krunchy-chicken",
      image: null,
    });
    expect(candidates[0]).toContain("Krispy_Krunchy_Chicken_logo.jpg");
  });

  it("gives Luckin Coffee and Grub Hub official marks without an API image", () => {
    expect(
      tenantLogoCandidates({ name: "Luckin Coffee", tenantSlug: "luckin-coffee" })[0],
    ).toBe("/brands/luckin-coffee-logo.png");
    expect(
      tenantLogoCandidates({ name: "Grub Hub", tenantSlug: "grub-hub" })[0],
    ).toContain("Grubhub_2025_logo.svg");
  });

  it("gives Anthropic the Claude symbol without an API image", () => {
    const candidates = tenantLogoCandidates({
      name: "Anthropic",
      tenantSlug: "anthropic",
      image: null,
    });
    expect(candidates[0]).toContain("Claude_AI_symbol.svg");
  });

  it("gives Kalshi the bundled official wordmark without an API image", () => {
    expect(
      tenantLogoCandidates({ name: "Kalshi", tenantSlug: "kalshi" })[0],
    ).toBe("/brands/kalshi-logo.svg");
  });

  it("still prefers a tenant image/logoUrl over the KKC Wikipedia mark", () => {
    const api =
      "https://storage.googleapis.com/sparkio-production/tenants/images/kkc.png";
    expect(
      tenantLogoCandidates({
        name: "Krispy Krunchy Chicken",
        image: api,
        logoUrl: api,
      }),
    ).toEqual([api, "https://upload.wikimedia.org/wikipedia/en/b/b3/Krispy_Krunchy_Chicken_logo.jpg"]);
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

describe("shortTenantName", () => {
  it("keeps a short brand name as-is", () => {
    expect(shortTenantName("Torch THC")).toBe("Torch THC");
    expect(shortTenantName("Neutonic")).toBe("Neutonic");
  });

  it("shortens a long name instead of leaving a hole", () => {
    expect(shortTenantName("Really Long Brand Name That Would Overflow")).toBe(
      "Really Long",
    );
  });

  it("falls back to Brand when empty", () => {
    expect(shortTenantName(null)).toBe("Brand");
    expect(shortTenantName("")).toBe("Brand");
  });
});
