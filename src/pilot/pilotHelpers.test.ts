import { describe, expect, it } from "vitest";
import {
  evidenceBadgeMeta,
  exceptionStatusLabel,
  formatCoveragePercent,
  formatHonestMoney,
  settlementBadgeMeta,
  storeActionLabel,
  workspaceRoleLabel,
} from "./pilotHelpers";
import { isPublicFieldPath, providerSubmitUrl } from "@/utils/publicHosts";

describe("pilotHelpers", () => {
  it("distinguishes unknown cost from confirmed $0.00", () => {
    expect(formatHonestMoney(null)).toBe("Unknown");
    expect(formatHonestMoney("")).toBe("Unknown");
    expect(formatHonestMoney("0.00", { isConfirmedZero: true })).toBe("$0.00");
    expect(formatHonestMoney("290.00")).toBe("$290.00");
    expect(formatHonestMoney("250.00", { incomplete: true })).toBe(
      "$250.00 (incomplete)",
    );
  });

  it("formats workspace roles, badges, and store actions", () => {
    expect(workspaceRoleLabel("brand_admin")).toBe("Brand Admin");
    expect(workspaceRoleLabel("finance_reviewer")).toBe("Finance Reviewer");
    expect(workspaceRoleLabel("provider_manager")).toBe("Agency Manager");
    expect(settlementBadgeMeta("paid").label).toBe("Paid");
    expect(evidenceBadgeMeta("missing").label).toBe("Missing proof / rate");
    expect(exceptionStatusLabel("exception_granted")).toBe("Exception granted");
    expect(storeActionLabel("rebook")).toBe("Rebook visit");
    expect(storeActionLabel("hold")).toBe("Hold store");
    expect(storeActionLabel("restock")).toBe("Restock / store check");
  });

  it("formats POS coverage ratios cleanly", () => {
    expect(formatCoveragePercent(null)).toBe("0%");
    expect(formatCoveragePercent("0.7500")).toBe("75%");
    expect(formatCoveragePercent("1.0000")).toBe("100%");
  });

  it("mints provider mobile submission URLs on clientOrigin and marks path public", () => {
    expect(providerSubmitUrl("PA-7K3M9Q")).toBe(
      "https://client.igniteproductions.co/provider-submit/PA-7K3M9Q",
    );
    expect(isPublicFieldPath("/provider-submit/PA-7K3M9Q")).toBe(true);
  });
});
