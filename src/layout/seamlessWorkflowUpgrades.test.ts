import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { commitLocalUpdate } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import environment, {
  executeAuthenticatedGraphQL,
  resetRelayStore,
} from "@/api/relay/environment";
import {
  clearJumpRecents,
  jumpGroupOf,
  loadJumpRecents,
  rememberJumpRecent,
} from "@/layout/jumpRecents";
import {
  resolveWorkspaceSwitchPath,
  switchWorkspace,
} from "@/layout/workspaceSwitch";
import { useAuthStore } from "@/store/authStore";

const readSrc = (rel: string) =>
  readFileSync(resolve(__dirname, rel), "utf8");

function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

installMemoryLocalStorage();

describe("4.1 zero-reload workspace switch & live theme toggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps collection and tool routes on workspace switch while stripping record-specific query params", () => {
    for (const route of [
      "/recaps/list",
      "/requests/list",
      "/account-map",
      "/schedule",
      "/walkups",
      "/reports",
      "/insights",
      "/billing",
      "/client-dashboard",
    ]) {
      expect(resolveWorkspaceSwitchPath(route)).toBe(route);
    }

    expect(
      resolveWorkspaceSwitchPath("/recaps/list", {
        search: "?status=needs_review&q=Sprouts&ba=123",
      }),
    ).toBe("/recaps/list?status=needs_review");

    expect(
      resolveWorkspaceSwitchPath("/client-dashboard", {
        hash: "#performance",
        isClient: true,
      }),
    ).toBe("/client-dashboard#performance");
  });

  it("falls back cleanly from record-detail routes to parent collections", () => {
    expect(resolveWorkspaceSwitchPath("/recap/view-custom/abc-123")).toBe(
      "/recaps/list",
    );
    expect(resolveWorkspaceSwitchPath("/recap/view/abc-123")).toBe(
      "/recaps/list",
    );
    expect(resolveWorkspaceSwitchPath("/request/view/req-99")).toBe(
      "/requests/list",
    );
    expect(resolveWorkspaceSwitchPath("/event/edit/ev-42")).toBe(
      "/requests/list",
    );
    expect(resolveWorkspaceSwitchPath("/store/s42")).toBe("/account-map");
    expect(resolveWorkspaceSwitchPath("/job/view/job-7")).toBe("/jobs");
    expect(resolveWorkspaceSwitchPath("/plans/plan-7")).toBe("/plans");
    expect(resolveWorkspaceSwitchPath("/clients/tenant-uuid-1")).toBe(
      "/clients",
    );
    expect(resolveWorkspaceSwitchPath("/clients/new")).toBe("/clients/new");
    expect(resolveWorkspaceSwitchPath("/ba/ba-uuid-1")).toBe("/talent");
  });

  it("switches workspace in place, clears Relay RecordSource, and avoids window.location.reload", () => {
    const navigate = vi.fn();
    commitLocalUpdate(environment, (store) => {
      store.create("client:stale-record", "Dummy");
    });
    expect(environment.getStore().getSource().get("client:stale-record")).toBeTruthy();

    const target = switchWorkspace(
      {
        id: "Tenant:42",
        uuid: "11111111-2222-3333-4444-555555555555",
        name: "Brew Dr",
        tenantSlug: "brew-dr-kombucha",
        requestUrlName: "brew-dr-kombucha",
        checkinCode: "BD-AQRACD",
      },
      {
        pathname: "/recaps/list",
        search: "?status=needs_review",
        navigate,
      },
    );

    expect(target).toBe("/recaps/list?status=needs_review");
    expect(navigate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().tenantUuid).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
    expect(
      environment.getStore().getSource().get("client:stale-record"),
    ).toBeUndefined();

    expect(readSrc("./TenantPicker.tsx")).not.toContain(
      "window.location.reload",
    );
    expect(readSrc("./SparkTopbar.tsx")).not.toContain(
      "window.location.reload",
    );
  });
});

describe("4.2 Jump batched search, instant actions, and BA/store routing", () => {
  beforeEach(() => {
    clearJumpRecents();
  });

  it("groups action entries and rewrites legacy /ba/:uuid recents to /talent?ba=:uuid", () => {
    expect(jumpGroupOf("action-copy-checkin-link")).toBe("actions");
    expect(jumpGroupOf("store-s42")).toBe("stores");
    expect(jumpGroupOf("ba-123")).toBe("people");

    rememberJumpRecent({
      id: "ba-abc",
      label: "Maya Sprouts",
      hint: "Ambassador",
      to: "/ba/abc-123",
    });
    expect(loadJumpRecents()[0]?.to).toBe("/talent?ba=abc-123");
  });

  it("replaces 6 parallel Jump queries with JumpSearchQuery and wires instant actions", () => {
    const palette = readSrc("./CommandPalette.tsx");
    expect(palette).toContain("JumpSearchQuery");
    expect(palette).not.toContain("AmbassadorsListQuery");
    expect(palette).not.toContain("RequestSearchQuery");
    expect(palette).not.toContain("RecapsSearchQuery");
    expect(palette).not.toContain("EventSearchQuery");
    expect(palette).not.toContain("ClientSearchQuery");
    expect(palette).not.toContain("RetailersSearchQuery");
    expect(palette).toContain("Switch client:");
    expect(palette).toContain("Copy standing check-in link");
    expect(palette).toContain("Copy public request link");
    expect(palette).toContain("New request at");
    expect(palette).toContain("/talent?ba=");
    expect(palette).toContain("storeHref");
  });
});

describe("4.4 executeAuthenticatedGraphQL single-flight refresh & tenant header", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("@token", "expired-jwt");
    localStorage.setItem("@refreshToken", "valid-refresh-token");
    useAuthStore.setState({
      token: "expired-jwt",
      refreshToken: "valid-refresh-token",
      tenantUuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetRelayStore();
  });

  it("attaches X-Spark-Tenant and shares one single-flight refreshToken call across concurrent expired requests", async () => {
    let refreshCalls = 0;
    const seenHeaders: Array<Record<string, string>> = [];

    globalThis.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query?: string;
      };
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seenHeaders.push(headers);

      if (body.query?.includes("refreshToken")) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return new Response(
          JSON.stringify({
            data: {
              refreshToken: {
                success: true,
                errors: null,
                token: { token: "fresh-jwt-token" },
              },
            },
          }),
          { status: 200 },
        );
      }

      if (headers.Authorization === "JWT expired-jwt") {
        return new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: "Signature has expired" }],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          data: { ok: true, auth: headers.Authorization },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const [r1, r2, r3] = await Promise.all([
      executeAuthenticatedGraphQL<{ ok: boolean; auth: string }>(
        "query One { ok }",
      ),
      executeAuthenticatedGraphQL<{ ok: boolean; auth: string }>(
        "query Two { ok }",
      ),
      executeAuthenticatedGraphQL<{ ok: boolean; auth: string }>(
        "query Three { ok }",
      ),
    ]);

    expect(refreshCalls).toBe(1);
    expect(r1.data?.auth).toBe("JWT fresh-jwt-token");
    expect(r2.data?.auth).toBe("JWT fresh-jwt-token");
    expect(r3.data?.auth).toBe("JWT fresh-jwt-token");
    expect(localStorage.getItem("@token")).toBe("fresh-jwt-token");
    const nonRefreshHeaders = seenHeaders.filter(
      (h) => h["X-Spark-Tenant"] !== undefined,
    );
    expect(nonRefreshHeaders.length).toBeGreaterThanOrEqual(6);
    for (const h of nonRefreshHeaders) {
      expect(h["X-Spark-Tenant"]).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    }
  });

  it("routes SparkApprovals, SparkBulkUpload, and SparkNewClient through executeAuthenticatedGraphQL", () => {
    for (const rel of [
      "../components/pages/approvals/SparkApprovals.tsx",
      "../requests/SparkBulkUpload.tsx",
      "../components/pages/clients/SparkNewClient.tsx",
    ]) {
      const code = readSrc(rel);
      expect(code, rel).toContain("executeAuthenticatedGraphQL");
      expect(code, rel).not.toContain("VITE_GRAPHQL_ENDPOINT");
    }
  });
});
