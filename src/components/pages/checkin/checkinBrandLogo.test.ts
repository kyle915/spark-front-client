import { describe, expect, it } from "vitest";
import { tenantLogoCandidates } from "@/layout/tenantLogo";

/**
 * Walk-up /checkin and spark-form must resolve the same TenantLogo
 * candidates — same official marks, no second asset path.
 */
describe("check-in brand logo matches spark-form", () => {
  it("Liquid Death uses the official TenantLogo mark", () => {
    const walkup = tenantLogoCandidates({
      name: "Liquid Death",
      requestUrlName: "ighn-liquid-death",
    });
    const form = tenantLogoCandidates({
      name: "Liquid Death",
      requestUrlName: "ighn-liquid-death",
    });
    expect(walkup[0]).toContain("Liquid-Death-Logo.svg");
    expect(walkup).toEqual(form);
  });

  it("Torch uses the same mark as the keee-torch-thc form", () => {
    const walkup = tenantLogoCandidates({
      name: "Torch THC",
      requestUrlName: "keee-torch-thc",
    });
    const form = tenantLogoCandidates({
      name: "Torch THC",
      requestUrlName: "keee-torch-thc",
    });
    expect(walkup[0]).toContain("TorchLogo");
    expect(walkup).toEqual(form);
  });

  it("Krispy Krunchy Chicken uses the official Wikipedia barn mark", () => {
    const walkup = tenantLogoCandidates({
      name: "Krispy Krunchy Chicken",
      requestUrlName: "krispy-krunchy-chicken",
    });
    const form = tenantLogoCandidates({
      name: "Krispy Krunchy Chicken",
      tenantSlug: "krispy-krunchy-chicken",
    });
    expect(walkup[0]).toContain("Krispy_Krunchy_Chicken_logo.jpg");
    expect(walkup).toEqual(form);
  });

  it("Luckin Coffee and Grub Hub use the same marks on walk-up and spark-form", () => {
    const luckinWalkup = tenantLogoCandidates({
      name: "Luckin Coffee",
      tenantSlug: "luckin-coffee",
    });
    const luckinForm = tenantLogoCandidates({
      name: "Luckin Coffee",
      requestUrlName: "luckin-coffee",
    });
    expect(luckinWalkup[0]).toBe("/brands/luckin-coffee-logo.png");
    expect(luckinWalkup).toEqual(luckinForm);

    const grubWalkup = tenantLogoCandidates({
      name: "Grub Hub",
      tenantSlug: "grub-hub",
    });
    const grubForm = tenantLogoCandidates({
      name: "Grub Hub",
      requestUrlName: "grub-hub",
    });
    expect(grubWalkup[0]).toContain("Grubhub_2025_logo.svg");
    expect(grubWalkup).toEqual(grubForm);
  });

  it("prefers the tenant image/logoUrl the check-in API now sends", () => {
    const api =
      "https://storage.googleapis.com/sparkio-production/tenants/images/girl-beer.png";
    expect(
      tenantLogoCandidates({
        name: "Girl Beer",
        image: api,
        logoUrl: api,
      }),
    ).toEqual([api]);
  });
});
