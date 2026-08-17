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
