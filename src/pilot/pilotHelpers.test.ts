import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWorkspaceContextSelection,
  buildInitialShiftFormState,
  evidenceBadgeMeta,
  exceptionStatusLabel,
  formatCoveragePercent,
  formatHonestMoney,
  settlementBadgeMeta,
  storeActionLabel,
  workspaceRoleLabel,
} from "./pilotHelpers";
import { useAuthStore } from "@/store/authStore";
import { isPublicFieldPath, providerSubmitUrl } from "@/utils/publicHosts";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe("pilotHelpers", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });
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

  it("resets all shift metric and spend inputs for a new mobile submission shift", () => {
    const programFresh = buildInitialShiftFormState(null, "2026-10-20");
    expect(programFresh).toEqual({
      storeBanner: "",
      storeNumber: "",
      address: "",
      city: "",
      stateCode: "",
      visitDate: "2026-10-20",
      shiftKey: "default",
      repName: "",
      samplesDistributed: "",
      consumersSampled: "",
      repObservedUnits: "",
      notes: "",
      productSpendAmount: "",
      supplySpendAmount: "",
      isReceiptItemized: true,
    });

    const visitFresh = buildInitialShiftFormState(
      {
        uuid: "visit-1",
        store_label: "FreshMart #102",
        address: "400 Congress Ave",
        city: "Austin",
        state_code: "TX",
        visit_date: "2026-10-14",
      },
      "2026-10-20",
    );
    expect(visitFresh.storeBanner).toBe("FreshMart #102");
    expect(visitFresh.visitDate).toBe("2026-10-14");
    expect(visitFresh.samplesDistributed).toBe("");
    expect(visitFresh.consumersSampled).toBe("");
    expect(visitFresh.repObservedUnits).toBe("");
    expect(visitFresh.productSpendAmount).toBe("");
    expect(visitFresh.supplySpendAmount).toBe("");
  });

  it("clears stale tenant metadata and hydrates target brand fields on workspace context switch", async () => {
    const store = useAuthStore.getState();
    store.setTenant(
      "uuid-old-brand",
      "Tenant:old-id",
      "https://cdn.test/old-logo.png",
      "old-request-url",
      "old-brand",
      "OLD-123",
    );

    // 1. Provider-only context switch (TenantQuery returns 0 rows) wipes old brand fields cleanly.
    await applyWorkspaceContextSelection(
      {
        membershipUuid: "mem-agency-b",
        tenantUuid: "uuid-new-brand",
        tenantSlug: "new-brand",
        workspaceRole: "provider_manager",
      },
      async () => [],
    );

    const afterProviderSwitch = useAuthStore.getState();
    expect(afterProviderSwitch.tenantUuid).toBe("uuid-new-brand");
    expect(afterProviderSwitch.tenantId).toBe("");
    expect(afterProviderSwitch.tenantSlug).toBe("new-brand");
    expect(afterProviderSwitch.membershipUuid).toBe("mem-agency-b");
    expect(afterProviderSwitch.workspaceRole).toBe("provider_manager");
    expect(afterProviderSwitch.tenantMeta?.logo).toBeNull();
    expect(afterProviderSwitch.tenantMeta?.requestUrlName).toBeNull();
    expect(afterProviderSwitch.tenantMeta?.checkinCode).toBeNull();
    expect(localStorage.getItem("@tenantLogo")).toBeNull();
    expect(localStorage.getItem("@tenantCheckinCode")).toBeNull();

    // 2. Brand context switch hydrates full TenantQuery metadata for the target brand.
    await applyWorkspaceContextSelection(
      {
        membershipUuid: "mem-brand-c",
        tenantUuid: "uuid-brand-c",
        tenantSlug: "brand-c",
        workspaceRole: "brand_admin",
      },
      async () => [
        {
          id: "Tenant:brand-c-id",
          uuid: "uuid-brand-c",
          name: "Brand C",
          logo: "https://cdn.test/brand-c.png",
          requestUrlName: "brand-c-requests",
          tenantSlug: "brand-c",
          checkinCode: "BC-999",
        },
      ],
    );

    const afterBrandSwitch = useAuthStore.getState();
    expect(afterBrandSwitch.tenantUuid).toBe("uuid-brand-c");
    expect(afterBrandSwitch.tenantId).toBe("Tenant:brand-c-id");
    expect(afterBrandSwitch.tenantSlug).toBe("brand-c");
    expect(afterBrandSwitch.tenantMeta?.logo).toBe(
      "https://cdn.test/brand-c.png",
    );
    expect(afterBrandSwitch.tenantMeta?.requestUrlName).toBe(
      "brand-c-requests",
    );
    expect(afterBrandSwitch.tenantMeta?.checkinCode).toBe("BC-999");

    // 3. Direct setTenantUuid to a different brand also clears stale metadata.
    useAuthStore.getState().setTenantUuid("uuid-brand-d");
    expect(useAuthStore.getState().tenantId).toBeNull();
    expect(useAuthStore.getState().tenantSlug).toBeNull();
    expect(useAuthStore.getState().tenantMeta).toBeNull();
  });
});
