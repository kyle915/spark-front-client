import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@api/auth/login", () => ({ login: vi.fn() }));
vi.mock("@api/auth/me", () => ({ fetchMe: vi.fn() }));
vi.mock("@/lib/prefetchHotRelayData", () => ({
  resetHotRelayDataPrefetch: vi.fn(),
}));

import {
  PILOT_CONTRAST_PALETTE,
  applyWorkspaceContextSelection,
  buildInitialShiftFormState,
  computeVisitMeterProgress,
  createInitialOnboardingSignupState,
  createInitialQuickRecapState,
  currentDateInTimezone,
  evidenceBadgeMeta,
  exceptionStatusLabel,
  filterVisibleWorkspaceContexts,
  formatCoveragePercent,
  formatHonestMoney,
  formatPilotCountdown,
  formatSingleWorkspaceBadgeLabel,
  isArchivedWorkspaceLabel,
  planBadgeMeta,
  resolveActiveWorkspaceContextKey,
  settlementBadgeMeta,
  storeActionLabel,
  subscriptionStatusBadge,
  validateOnboardingQuickRecap,
  workspaceContextOptionKey,
  workspaceRoleLabel,
} from "./pilotHelpers";
import { useAuthStore } from "@/store/authStore";
import {
  isPublicFieldPath,
  providerSubmitUrl,
  workspaceSharePublicUrl,
} from "@/utils/publicHosts";

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
      {
        store: useAuthStore.getState(),
        loadTenants: async () => [],
      },
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
      {
        store: useAuthStore.getState(),
        loadTenants: async () => [
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
      },
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

  it("filters [ARCHIVED] workspaces unless active and keeps active option synced to sidebar tenantUuid", () => {
    expect(isArchivedWorkspaceLabel("[ARCHIVED] Carbliss")).toBe(true);
    expect(isArchivedWorkspaceLabel("  [archived] WERNSA · Managed Workspace")).toBe(true);
    expect(isArchivedWorkspaceLabel("Liquid Death")).toBe(false);

    const rawContexts = [
      {
        membershipUuid: null,
        tenantUuid: "uuid-alcohol-armor",
        tenantName: "Alcohol Armor",
        displayLabel: "Alcohol Armor · Managed Workspace",
        isCurrent: false,
      },
      {
        membershipUuid: null,
        tenantUuid: "uuid-carbliss",
        tenantName: "[ARCHIVED] Carbliss",
        displayLabel: "[ARCHIVED] Carbliss · Managed Workspace",
        isCurrent: false,
      },
      {
        membershipUuid: null,
        tenantUuid: "uuid-wernsa",
        tenantName: "[ARCHIVED] WERNSA",
        displayLabel: "[ARCHIVED] WERNSA · Managed Workspace",
        isCurrent: false,
      },
      {
        membershipUuid: null,
        tenantUuid: "uuid-liquid-death",
        tenantName: "Liquid Death",
        displayLabel: "Liquid Death · Managed Workspace",
        isCurrent: false,
      },
      {
        membershipUuid: "mem-agency-brew",
        tenantUuid: "uuid-brew-dr",
        tenantName: "Brew Dr",
        providerName: "FieldPulse",
        displayLabel: "Brew Dr · FieldPulse (Agency Manager)",
        isCurrent: false,
      },
    ];

    const visible = filterVisibleWorkspaceContexts(rawContexts, {
      tenantUuid: "uuid-liquid-death",
      membershipUuid: null,
    });
    expect(visible.map((c) => c.tenantName)).toEqual([
      "Alcohol Armor",
      "Liquid Death",
      "Brew Dr",
    ]);

    expect(
      resolveActiveWorkspaceContextKey(visible, {
        tenantUuid: "uuid-liquid-death",
        membershipUuid: null,
      }),
    ).toBe("tenant:uuid-liquid-death");

    expect(
      resolveActiveWorkspaceContextKey(visible, {
        tenantUuid: "uuid-alcohol-armor",
        membershipUuid: null,
      }),
    ).toBe("tenant:uuid-alcohol-armor");

    expect(
      resolveActiveWorkspaceContextKey(visible, {
        tenantUuid: "uuid-brew-dr",
        membershipUuid: "mem-agency-brew",
      }),
    ).toBe("membership:mem-agency-brew");
    expect(workspaceContextOptionKey(visible[2])).toBe(
      "membership:mem-agency-brew",
    );

    const visibleWhenArchivedSelected = filterVisibleWorkspaceContexts(
      rawContexts,
      { tenantUuid: "uuid-carbliss", membershipUuid: null },
    );
    expect(
      visibleWhenArchivedSelected.some((c) => c.tenantUuid === "uuid-carbliss"),
    ).toBe(true);

    expect(
      formatSingleWorkspaceBadgeLabel({
        tenantName: "Liquid Death",
        providerName: null,
        displayLabel: "Liquid Death · Managed Workspace",
      }),
    ).toBe("Liquid Death");
    expect(
      formatSingleWorkspaceBadgeLabel({
        tenantName: "Liquid Death",
        providerName: "FieldPulse",
        displayLabel: "Liquid Death · FieldPulse (Agency Manager)",
      }),
    ).toBe("Liquid Death · FieldPulse");
  });

  it("formats Milestone 2 plan badges, subscription states, visit meter caps, and pilot countdowns", () => {
    expect(planBadgeMeta("free").priceSummary).toBe("$0/mo · 5 visits");
    expect(planBadgeMeta("core").priceSummary).toBe("$299/mo · 50 visits");
    expect(planBadgeMeta("pro").priceSummary).toBe("$750/mo · 100 visits");
    expect(planBadgeMeta("pilot_pro").label).toBe("60-Day Pro Pilot");
    expect(planBadgeMeta("scale").label).toBe("Scale");
    expect(planBadgeMeta("managed_sow").label).toBe("Managed SOW");

    expect(subscriptionStatusBadge("past_due").label).toBe("Payment Past Due");
    expect(subscriptionStatusBadge("cancel_at_period_end").label).toContain(
      "Paid-Through",
    );

    const underCap = computeVisitMeterProgress({
      completedVisitsUsed: 3,
      effectiveVisitCap: 5,
    });
    expect(underCap.percent).toBe(60);
    expect(underCap.isAtCap).toBe(false);
    expect(underCap.remainingLabel).toBe("2 included visits remaining this month");

    const atCapWithInProgress = computeVisitMeterProgress({
      completedVisitsUsed: 6,
      effectiveVisitCap: 5,
    });
    expect(atCapWithInProgress.percent).toBe(100);
    expect(atCapWithInProgress.isAtCap).toBe(true);
    expect(atCapWithInProgress.remainingLabel).toContain("no automatic charge");

    const managedMeter = computeVisitMeterProgress({
      completedVisitsUsed: 42,
      effectiveVisitCap: null,
    });
    expect(managedMeter.isAtCap).toBe(false);
    expect(managedMeter.summaryLabel).toContain("Managed SOW");

    const countdown = formatPilotCountdown(
      "2026-12-31T00:00:00Z",
      Date.parse("2026-11-01T00:00:00Z"),
    );
    expect(countdown).toBe("60 days left in 60-day Pro pilot (ends 2026-12-31)");

    expect(workspaceSharePublicUrl("wsl_demo123")).toBe(
      "https://client.igniteproductions.co/workspace-share/wsl_demo123",
    );
    expect(isPublicFieldPath("/workspace-share/wsl_demo123")).toBe(true);

    const lateEveningUtc = new Date("2026-11-23T02:30:00Z");
    expect(currentDateInTimezone("America/Los_Angeles", lateEveningUtc)).toBe(
      "2026-11-22",
    );
    expect(currentDateInTimezone("America/Chicago", lateEveningUtc)).toBe(
      "2026-11-22",
    );
    expect(currentDateInTimezone("Invalid/Timezone", lateEveningUtc)).toBe(
      "2026-11-22",
    );
    expect(currentDateInTimezone("UTC", lateEveningUtc)).toBe("2026-11-23");

    const signupState = createInitialOnboardingSignupState();
    expect(signupState.acceptTerms).toBe(false);

    const quickInit = createInitialQuickRecapState(
      "America/Los_Angeles",
      lateEveningUtc,
    );
    expect(quickInit).toEqual({
      storeName: "",
      city: "",
      stateCode: "",
      visitDate: "2026-11-22",
      samplesDistributed: "",
      consumersSampled: "",
      repObservedUnits: "",
    });
    expect(validateOnboardingQuickRecap(quickInit).ok).toBe(false);
    expect(
      validateOnboardingQuickRecap({
        ...quickInit,
        storeName: "Sunset Market #14",
      }).ok,
    ).toBe(false);
    expect(
      validateOnboardingQuickRecap({
        storeName: " Sunset Market #14 ",
        city: " Austin ",
        stateCode: "tx",
        visitDate: quickInit.visitDate,
        samplesDistributed: "84",
        consumersSampled: "68",
        repObservedUnits: "19",
      }),
    ).toEqual({
      ok: true,
      payload: {
        storeName: "Sunset Market #14",
        city: "Austin",
        stateCode: "TX",
        visitDate: "2026-11-22",
        samplesDistributed: 84,
        consumersSampled: 68,
        repObservedUnits: 19,
      },
    });
  });

  it("enforces WCAG AA+ contrast ratios across both dark and light Milestone 2 palettes with zero neon lime", () => {
    function relativeLuminance(hex: string): number {
      const clean = hex.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((idx) => {
        const s = parseInt(clean.slice(idx, idx + 2), 16) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrastRatio(fgHex: string, bgHex: string): number {
      const l1 = relativeLuminance(fgHex);
      const l2 = relativeLuminance(bgHex);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    for (const mode of ["dark", "light"] as const) {
      const p = PILOT_CONTRAST_PALETTE[mode];
      const allValues = Object.values(p).map((v) => v.toLowerCase());
      for (const banned of ["#c5f546", "#c8ff00", "#b8ff00", "#d4ff00"]) {
        expect(allValues).not.toContain(banned);
      }

      expect(contrastRatio(p.ctaFg, p.ctaBg)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(p.text, p.pageBg)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(p.text, p.cardBg)).toBeGreaterThanOrEqual(7.0);

      for (const [fg, bg] of [
        [p.okFg, p.okBg],
        [p.okFg, p.cardBg],
        [p.okFg, p.pageBg],
        [p.infoFg, p.infoBg],
        [p.infoFg, p.cardBg],
        [p.warnFg, p.warnBg],
        [p.warnFg, p.cardBg],
        [p.dangerFg, p.dangerBg],
        [p.dangerFg, p.cardBg],
        [p.neutralFg, p.neutralBg],
        [p.neutralFg, p.cardBg],
      ] as const) {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }

      for (const bar of [p.meterOk, p.meterWarn, p.meterDanger] as const) {
        expect(contrastRatio(bar, p.meterTrack)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
