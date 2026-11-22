import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { commitLocalUpdate } from "relay-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useSidebarCounts", () => ({
  refreshSidebarCounts: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("@/lib/prefetchHotRelayData", () => ({
  resetHotRelayDataPrefetch: vi.fn(),
}));
vi.mock("@api/auth/me", () => ({ fetchMe: vi.fn() }));
vi.mock("@api/auth/login", () => ({ login: vi.fn() }));
vi.mock("@/api/queries/PilotQueries", () => ({
  PilotQueriesWorkspaceContextsQuery: {},
}));
vi.mock("@/api/mutations/PilotMutations", () => ({
  PilotMutationsSwitchContextMutation: {},
  PilotMutationsCreateStoreActionMutation: {},
}));
vi.mock("@/api/queries/TenantQuery", () => ({
  TenantQuery: {},
}));
vi.mock("@/api/queries/TenantStoreInsightsQuery", () => ({
  TenantStoreInsightsQuery: {},
}));

import environment from "@/api/relay/environment";
import { WhereToGoNextCard } from "@/components/ai/StoreInsightsCards";
import { WorkspaceSwitcherView } from "@/layout/TenantPicker";
import {
  captureWorkspaceSnapshot,
  restoreWorkspaceSnapshot,
  switchWorkspace,
} from "@/layout/workspaceSwitch";
import {
  buildUnifiedWorkspaceOptions,
  type WorkspaceContextItem,
} from "@/pilot/pilotHelpers";
import { useAuthStore } from "@/store/authStore";

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

describe("Unified sidebar workspace switcher & single-brand client isolation", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    useAuthStore.setState({
      isAuthenticated: true,
      tenantUuid: null,
      membershipUuid: null,
      workspaceRole: null,
    });
  });

  it("consolidates workspace switching into one sidebar control with no duplicate topbar dropdown", () => {
    const topbarSrc = readFileSync(
      resolve(__dirname, "../layout/SparkTopbar.tsx"),
      "utf8",
    );
    const sidebarSrc = readFileSync(
      resolve(__dirname, "../layout/SparkSidebar.tsx"),
      "utf8",
    );

    expect(topbarSrc).not.toContain("WorkspaceContextSwitcher");
    expect(topbarSrc).not.toContain("<select");
    expect(sidebarSrc).toContain("<TenantPicker />");
    expect(sidebarSrc).toContain("Workspace");
  });

  it("renders a static non-interactive workspace pill (no dropdown trigger or list) for a single-brand client", () => {
    const singleClientContexts: WorkspaceContextItem[] = [
      {
        membershipUuid: "mem-ld-1",
        tenantUuid: "uuid-liquid-death",
        tenantName: "Liquid Death",
        tenantSlug: "liquid-death",
        workspaceRole: "brand_admin",
        providerUuid: null,
        providerName: null,
        displayLabel: "Liquid Death · Brand Admin",
        isCurrent: true,
      },
    ];

    const options = buildUnifiedWorkspaceOptions({
      contexts: singleClientContexts,
      tenants: [
        {
          id: "Tenant:ld",
          uuid: "uuid-liquid-death",
          name: "Liquid Death",
          logo: null,
          requestUrlName: "liquid-death",
          tenantSlug: "liquid-death",
          checkinCode: "LD-TNBJ8K",
        },
      ],
      active: { tenantUuid: "uuid-liquid-death", membershipUuid: "mem-ld-1" },
    });

    const html = renderToStaticMarkup(
      <WorkspaceSwitcherView
        options={options}
        tenantUuid="uuid-liquid-death"
        membershipUuid="mem-ld-1"
        onSelectOption={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="workspace-single-pill"');
    expect(html).toContain(">Liquid Death<");
    expect(html).not.toContain('data-testid="workspace-switcher-trigger"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<option");
  });

  it("supports multi-brand agency users even when TenantQuery returns 0 rows", () => {
    const agencyContexts: WorkspaceContextItem[] = [
      {
        membershipUuid: "mem-fp-ld",
        tenantUuid: "uuid-liquid-death",
        tenantName: "Liquid Death",
        tenantSlug: "liquid-death",
        workspaceRole: "provider_manager",
        providerUuid: "prov-fp",
        providerName: "FieldPulse",
        displayLabel: "Liquid Death · FieldPulse (Agency Manager)",
        isCurrent: false,
      },
      {
        membershipUuid: "mem-fp-bd",
        tenantUuid: "uuid-brew-dr",
        tenantName: "Brew Dr",
        tenantSlug: "brew-dr-kombucha",
        workspaceRole: "provider_manager",
        providerUuid: "prov-fp",
        providerName: "FieldPulse",
        displayLabel: "Brew Dr · FieldPulse (Agency Manager)",
        isCurrent: true,
      },
    ];

    const options = buildUnifiedWorkspaceOptions({
      contexts: agencyContexts,
      tenants: [],
      active: { tenantUuid: "uuid-brew-dr", membershipUuid: "mem-fp-bd" },
    });

    const html = renderToStaticMarkup(
      <WorkspaceSwitcherView
        options={options}
        tenantUuid="uuid-brew-dr"
        membershipUuid="mem-fp-bd"
        defaultOpen
        onSelectOption={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="workspace-switcher-trigger"');
    expect(html).toContain("FieldPulse · Agency Manager");
    expect(html).toContain("Brew Dr");
    expect(html).toContain("Liquid Death");
    expect(html).toContain(
      'aria-selected="true" data-workspace-key="membership:mem-fp-bd"',
    );
    expect(html).toContain(
      'aria-selected="false" data-workspace-key="membership:mem-fp-ld"',
    );
  });

  it("excludes [ARCHIVED] workspaces and selects Liquid Death (never alphabetical #1 Alcohol Armor) when Liquid Death is active", () => {
    const staffContexts: WorkspaceContextItem[] = [
      {
        membershipUuid: null,
        tenantUuid: "uuid-alcohol-armor",
        tenantName: "Alcohol Armor",
        tenantSlug: "alcohol-armor",
        workspaceRole: "brand_admin",
        providerUuid: null,
        providerName: null,
        displayLabel: "Alcohol Armor · Managed Workspace",
        isCurrent: false,
      },
      {
        membershipUuid: null,
        tenantUuid: "uuid-carbliss",
        tenantName: "[ARCHIVED] Carbliss",
        tenantSlug: "carbliss",
        workspaceRole: "brand_admin",
        providerUuid: null,
        providerName: null,
        displayLabel: "[ARCHIVED] Carbliss · Managed Workspace",
        isCurrent: false,
      },
      {
        membershipUuid: null,
        tenantUuid: "uuid-wernsa",
        tenantName: "[ARCHIVED] WERNSA",
        tenantSlug: "wernsa",
        workspaceRole: "brand_admin",
        providerUuid: null,
        providerName: null,
        displayLabel: "[ARCHIVED] WERNSA · Managed Workspace",
        isCurrent: false,
      },
      {
        membershipUuid: null,
        tenantUuid: "uuid-liquid-death",
        tenantName: "Liquid Death",
        tenantSlug: "liquid-death",
        workspaceRole: "brand_admin",
        providerUuid: null,
        providerName: null,
        displayLabel: "Liquid Death · Managed Workspace",
        isCurrent: false,
      },
    ];

    const options = buildUnifiedWorkspaceOptions({
      contexts: staffContexts,
      tenants: [],
      active: { tenantUuid: "uuid-liquid-death", membershipUuid: null },
    });

    const html = renderToStaticMarkup(
      <WorkspaceSwitcherView
        options={options}
        tenantUuid="uuid-liquid-death"
        membershipUuid={null}
        defaultOpen
        onSelectOption={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="workspace-switcher-trigger"');
    expect(html).not.toContain("Carbliss");
    expect(html).not.toContain("WERNSA");
    expect(html).toContain(
      'aria-selected="true" data-workspace-key="tenant:uuid-liquid-death"',
    );
    expect(html).toContain(
      'aria-selected="false" data-workspace-key="tenant:uuid-alcohol-armor"',
    );
  });

  it("filters workspaces by search query across brand name, slug, and agency provider", () => {
    const options = buildUnifiedWorkspaceOptions({
      contexts: [
        {
          membershipUuid: null,
          tenantUuid: "uuid-liquid-death",
          tenantName: "Liquid Death",
          tenantSlug: "liquid-death",
          workspaceRole: "brand_admin",
          providerUuid: null,
          providerName: null,
          displayLabel: "Liquid Death · Managed Workspace",
          isCurrent: true,
        },
        {
          membershipUuid: "mem-fp-bd",
          tenantUuid: "uuid-brew-dr",
          tenantName: "Brew Dr",
          tenantSlug: "brew-dr-kombucha",
          workspaceRole: "provider_manager",
          providerUuid: "prov-fp",
          providerName: "FieldPulse",
          displayLabel: "Brew Dr · FieldPulse (Agency Manager)",
          isCurrent: false,
        },
      ],
      tenants: [],
      active: { tenantUuid: "uuid-liquid-death", membershipUuid: null },
    });

    const html = renderToStaticMarkup(
      <WorkspaceSwitcherView
        options={options}
        tenantUuid="uuid-liquid-death"
        membershipUuid={null}
        defaultOpen
        defaultQuery="fieldpulse"
        onSelectOption={vi.fn()}
      />,
    );

    expect(html).toContain("Brew Dr");
    expect(html).not.toContain('data-workspace-key="tenant:uuid-liquid-death"');
  });

  it("synchronizes zero-reload switchWorkspace across tenantUuid, membershipUuid, and Relay store without window.location.reload", () => {
    const pickerSrc = readFileSync(
      resolve(__dirname, "../layout/TenantPicker.tsx"),
      "utf8",
    );
    expect(pickerSrc).not.toContain("window.location.reload");
    expect(pickerSrc).toContain("switchWorkspace(");
    expect(pickerSrc).toContain("PilotMutationsSwitchContextMutation");

    const navigate = vi.fn();
    commitLocalUpdate(environment, (store) => {
      store.create("client:liquid-death-cache", "Dummy");
    });

    // 1. Agency membership switch sets both tenantUuid & membershipUuid and clears Relay store.
    switchWorkspace(
      {
        id: "Tenant:brew",
        uuid: "uuid-brew-dr",
        name: "Brew Dr",
        tenantSlug: "brew-dr-kombucha",
      },
      {
        pathname: "/dashboard",
        membershipUuid: "mem-agency-brew",
        workspaceRole: "provider_manager",
        navigate,
      },
    );
    expect(useAuthStore.getState().tenantUuid).toBe("uuid-brew-dr");
    expect(useAuthStore.getState().membershipUuid).toBe("mem-agency-brew");
    expect(useAuthStore.getState().workspaceRole).toBe("provider_manager");
    expect(
      environment.getStore().getSource().get("client:liquid-death-cache"),
    ).toBeUndefined();

    // 2. Subsequent managed brand switch clears stale membershipUuid automatically.
    switchWorkspace(
      {
        id: "Tenant:ld",
        uuid: "uuid-liquid-death",
        name: "Liquid Death",
        tenantSlug: "liquid-death",
      },
      {
        pathname: "/dashboard",
        navigate,
      },
    );
    expect(useAuthStore.getState().tenantUuid).toBe("uuid-liquid-death");
    expect(useAuthStore.getState().membershipUuid).toBeNull();
    expect(useAuthStore.getState().workspaceRole).toBeNull();
  });

  it("rolls back tenant, membership, Relay store, and route when switchWorkspaceContext fails", () => {
    const pickerSrc = readFileSync(
      resolve(__dirname, "../layout/TenantPicker.tsx"),
      "utf8",
    );
    expect(pickerSrc).toContain("captureWorkspaceSnapshot(");
    expect(pickerSrc).toContain("!resp?.switchWorkspaceContext?.ok");
    expect(pickerSrc).toContain("restoreWorkspaceSnapshot(");

    const navigate = vi.fn();
    useAuthStore.getState().setWorkspaceMembership("mem-ld", "brand_admin");
    useAuthStore
      .getState()
      .setTenant(
        "uuid-liquid-death",
        "Tenant:ld",
        "https://cdn/ld.png",
        "liquid-death",
        "liquid-death",
        "LD-TNBJ8K",
      );

    const snapshot = captureWorkspaceSnapshot({
      pathname: "/recap/view/recap-123",
      search: "?tab=photos",
    });

    const switchedPath = switchWorkspace(
      {
        id: "Tenant:brew",
        uuid: "uuid-brew-dr",
        name: "Brew Dr",
        tenantSlug: "brew-dr-kombucha",
      },
      {
        pathname: "/recap/view/recap-123",
        search: "?tab=photos",
        membershipUuid: "mem-revoked",
        workspaceRole: "provider_manager",
        navigate,
      },
    );
    expect(switchedPath).toBe("/recaps/list");
    expect(useAuthStore.getState().tenantUuid).toBe("uuid-brew-dr");
    expect(useAuthStore.getState().membershipUuid).toBe("mem-revoked");

    commitLocalUpdate(environment, (store) => {
      store.create("client:unconfirmed-brew-cache", "Dummy");
    });

    restoreWorkspaceSnapshot(snapshot, {
      currentFullPath: switchedPath,
      navigate,
    });

    expect(useAuthStore.getState().tenantUuid).toBe("uuid-liquid-death");
    expect(useAuthStore.getState().tenantId).toBe("Tenant:ld");
    expect(useAuthStore.getState().tenantSlug).toBe("liquid-death");
    expect(useAuthStore.getState().membershipUuid).toBe("mem-ld");
    expect(useAuthStore.getState().workspaceRole).toBe("brand_admin");
    expect(
      environment.getStore().getSource().get("client:unconfirmed-brew-cache"),
    ).toBeUndefined();
    expect(navigate).toHaveBeenLastCalledWith(
      "/recap/view/recap-123?tab=photos",
      { replace: true },
    );
  });
});

describe("StoreInsightsCards Rebook button light/dark contrast", () => {
  it("renders Rebook button with high-contrast theme tokens instead of pale #c5f546 text", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WhereToGoNextCard
          items={[
            {
              id: "rec-1",
              code: "top_store",
              kind: "store",
              scopeKey: "sprouts-412",
              subject: "Sprouts #412",
              text: "Sprouts #412 moved 44 cans per shift across 3 visits — rebook next month.",
              isDraft: false,
              visitCount: 3,
              periodStart: "2026-08-01",
              periodEnd: "2026-11-01",
              comparisonPeriod: "Last 90d",
              supportedCost: "240.00",
              adjustedPosUnits: 52,
              currentActionUuid: null,
              currentActionType: null,
              currentActionStatus: null,
              currentActionOwner: null,
              currentActionProvider: null,
              eligibleStores: [
                { storeKey: "sprouts-412", storeLabel: "Sprouts #412" },
              ],
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(html).toContain(">Rebook<");
    expect(html).toContain(">Hold<");
    expect(html).toContain(">Restock check<");
    expect(html).toContain("background:var(--spark-lime)");
    expect(html).toContain("color:var(--spark-on-accent)");
    expect(html).not.toContain("#c5f546");
  });

  it("eliminates hardcoded neon-lime #c5f546 / #fde047 / #7dd3fc text across light-mode portal pages, sheets, and unified switcher", () => {
    const portalFiles = [
      "../layout/TenantPicker.tsx",
      "../components/ai/StoreInsightsCards.tsx",
      "../components/pages/map/WaveScheduleSheet.tsx",
      "../components/pages/map/SparkAccountMap.tsx",
      "./BrandWorkspacePage.tsx",
      "./BuyerReportPage.tsx",
      "./DemoCostsPage.tsx",
      "./FinanceQueuePage.tsx",
      "./ProviderImportsPage.tsx",
      "./RetailerPosPage.tsx",
      "./pilotHelpers.ts",
    ];
    for (const rel of portalFiles) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      expect(src, `${rel} should not hardcode #c5f546`).not.toContain(
        "#c5f546",
      );
      expect(src, `${rel} should not hardcode #fde047`).not.toContain(
        "#fde047",
      );
      expect(src, `${rel} should not hardcode #7dd3fc`).not.toContain(
        "#7dd3fc",
      );
    }

    const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    expect(css).toContain("--spark-ok-ink: #2b4c08;");
    expect(css).toContain('[data-spark-mode="light"] .chip-lime');
  });
});
