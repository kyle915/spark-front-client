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
import { switchWorkspace } from "@/layout/workspaceSwitch";
import { useAuthStore } from "@/store/authStore";
import {
  WorkspaceContextSwitcherView,
  type WorkspaceContextItem,
} from "./WorkspaceContextSwitcher";

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

describe("WorkspaceContextSwitcher & single-brand client isolation", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    useAuthStore.setState({
      isAuthenticated: true,
      tenantUuid: null,
      membershipUuid: null,
      workspaceRole: null,
    });
  });

  it("renders a clean non-interactive workspace pill (no <select> dropdown) when a client user only has 1 workspace", () => {
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

    const html = renderToStaticMarkup(
      <WorkspaceContextSwitcherView
        contexts={singleClientContexts}
        tenantUuid="uuid-liquid-death"
        membershipUuid="mem-ld-1"
        onSelectKey={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="workspace-single-pill"');
    expect(html).toContain(">Liquid Death<");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<option");
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

    const html = renderToStaticMarkup(
      <WorkspaceContextSwitcherView
        contexts={staffContexts}
        tenantUuid="uuid-liquid-death"
        membershipUuid={null}
        onSelectKey={vi.fn()}
      />,
    );

    expect(html).toContain("<select");
    expect(html).not.toContain("Carbliss");
    expect(html).not.toContain("WERNSA");
    // React SSR marks the matching <option selected="" value="tenant:uuid-liquid-death">
    expect(html).toMatch(
      /<option[^>]*value="tenant:uuid-liquid-death"[^>]*selected=""|<option[^>]*selected=""[^>]*value="tenant:uuid-liquid-death"/,
    );
    expect(html).not.toMatch(
      /<option[^>]*value="tenant:uuid-alcohol-armor"[^>]*selected=""|<option[^>]*selected=""[^>]*value="tenant:uuid-alcohol-armor"/,
    );
  });

  it("synchronizes zero-reload switchWorkspace across tenantUuid, membershipUuid, and Relay store without window.location.reload", () => {
    const switcherSrc = readFileSync(
      resolve(__dirname, "./WorkspaceContextSwitcher.tsx"),
      "utf8",
    );
    expect(switcherSrc).not.toContain("window.location.reload");
    expect(switcherSrc).toContain("switchWorkspace(");

    const navigate = vi.fn();
    commitLocalUpdate(environment, (store) => {
      store.create("client:liquid-death-cache", "Dummy");
    });

    // 1. Topbar switch to agency membership sets both tenantUuid & membershipUuid and clears Relay store.
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

    // 2. Subsequent sidebar TenantPicker switch to another brand clears stale membershipUuid automatically.
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

  it("eliminates hardcoded neon-lime #c5f546 / #fde047 / #7dd3fc text across light-mode portal pages and sheets", () => {
    const portalFiles = [
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
