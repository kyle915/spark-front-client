import { create } from "zustand";
import { login as loginService } from "@api/auth/login";
import { fetchMe, type MeUser } from "@api/auth/me";
import { themes } from "@/theme/themes";
import { resetHotRelayDataPrefetch } from "@/lib/hotRelayPrefetchState";
import { clearAllAdminAskThreads } from "@/components/ai/adminAskThreadStorage";
import { clearCachedLegalAcceptance } from "@/legal/acceptance/legalAcceptanceCache";

type TenantMeta = {
  logo?: string | null;
  requestUrlName?: string | null;
  checkinCode?: string | null;
};

interface AuthState {
  user: MeUser | null;
  token: string | null;
  refreshToken: string | null;
  tenantUuid: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  membershipUuid: string | null;
  workspaceRole: string | null;
  tenantMeta: TenantMeta | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  socialLogin: (token: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  setRefreshToken: (token: string) => void;
  loadFromStorage: () => Promise<void>;
  setTenantUuid: (uuid: string | null) => void;
  setTenantId: (id: string | null) => void;
  setWorkspaceMembership: (
    membershipUuid: string | null,
    workspaceRole?: string | null
  ) => void;
  setTenant: (
    tenantUuid: string,
    tenantId: string,
    logo?: string | null,
    requestUrlName?: string | null,
    tenantSlug?: string | null,
    checkinCode?: string | null
  ) => void;
  clearTenant: () => void;
}

const USER_SNAPSHOT_KEY = "@userSnapshot";

function safeGetItem(key: string): string | null {
  if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof localStorage === "undefined" || typeof localStorage.setItem !== "function") {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage quota / private mode */
  }
}

function safeRemoveItem(key: string): void {
  if (typeof localStorage === "undefined" || typeof localStorage.removeItem !== "function") {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function parseUserSnapshot(raw: string | null): MeUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NonNullable<MeUser>> | null;
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
      return parsed as MeUser;
    }
    return null;
  } catch {
    return null;
  }
}

function persistUserSnapshot(me: MeUser): void {
  if (!me) {
    safeRemoveItem(USER_SNAPSHOT_KEY);
    return;
  }
  try {
    safeSetItem(USER_SNAPSHOT_KEY, JSON.stringify(me));
  } catch {
    /* ignore */
  }
}

function applyStoredTheme(): void {
  if (typeof document === "undefined" || !document.documentElement) return;
  const theme = safeGetItem("@theme") || themes.light;
  document.documentElement.setAttribute("data-theme", theme);
}

export function readHydratedAuthSnapshot() {
  applyStoredTheme();
  const token = safeGetItem("@token");
  if (!token) {
    return {
      user: null as MeUser | null,
      token: null as string | null,
      refreshToken: null as string | null,
      tenantUuid: null as string | null,
      tenantId: null as string | null,
      tenantSlug: null as string | null,
      membershipUuid: null as string | null,
      workspaceRole: null as string | null,
      tenantMeta: null as TenantMeta | null,
      isAuthenticated: false,
    };
  }

  return {
    user: parseUserSnapshot(safeGetItem(USER_SNAPSHOT_KEY)),
    token,
    refreshToken: safeGetItem("@refreshToken"),
    tenantUuid: safeGetItem("@tenantUuid"),
    tenantId: safeGetItem("@tenantId"),
    tenantSlug: safeGetItem("@tenantSlug"),
    membershipUuid: safeGetItem("@membershipUuid"),
    workspaceRole: safeGetItem("@workspaceRole"),
    tenantMeta: {
      logo: safeGetItem("@tenantLogo"),
      requestUrlName: safeGetItem("@tenantRequestUrlName"),
      checkinCode: safeGetItem("@tenantCheckinCode"),
    } as TenantMeta,
    isAuthenticated: true,
  };
}

const initialSnapshot = readHydratedAuthSnapshot();

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialSnapshot,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const { token } = await loginService(username, password);
      const authToken = token.token;
      const refreshToken = token.refreshToken;
      safeSetItem("@token", authToken);
      if (refreshToken) {
        safeSetItem("@refreshToken", refreshToken);
      }
      safeRemoveItem("@tenantUuid");
      safeRemoveItem("@tenantSlug");
      const me = await fetchMe();
      persistUserSnapshot(me);

      set({
        user: me,
        token: authToken,
        refreshToken,
        tenantUuid: null,
        tenantSlug: null,
        tenantMeta: null,
        isAuthenticated: true,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error logging in";
      set({
        error: message,
        loading: false,
      });
      throw new Error(message);
    }
  },

  socialLogin: async (token: string, refreshToken: string) => {
    set({ loading: true, error: null });
    try {
      safeSetItem("@token", token);
      if (refreshToken) {
        safeSetItem("@refreshToken", refreshToken);
      }
      safeRemoveItem("@tenantUuid");
      safeRemoveItem("@tenantSlug");
      const me = await fetchMe();
      persistUserSnapshot(me);

      set({
        user: me,
        token,
        refreshToken,
        tenantUuid: null,
        tenantSlug: null,
        isAuthenticated: true,
        loading: false,
      });
    } catch (err) {
      const error = err as Error;
      set({
        error: error.message || "Error logging in",
        loading: false,
      });
    }
  },

  logout: () => {
    safeRemoveItem("@token");
    safeRemoveItem("@refreshToken");
    safeRemoveItem(USER_SNAPSHOT_KEY);

    safeRemoveItem("@tenantUuid");
    safeRemoveItem("@tenantId");
    safeRemoveItem("@tenantSlug");
    safeRemoveItem("@membershipUuid");
    safeRemoveItem("@workspaceRole");
    safeRemoveItem("@tenantLogo");
    safeRemoveItem("@tenantRequestUrlName");
    safeRemoveItem("@tenantCheckinCode");

    // Allow idle Relay warmup again after the next login, clear cached legal
    // status, and drop session-persisted Admin Ask Spark threads.
    resetHotRelayDataPrefetch();
    clearCachedLegalAcceptance();
    clearAllAdminAskThreads();

    set({
      user: null,
      token: null,
      refreshToken: null,
      tenantUuid: null,
      tenantId: null,
      tenantSlug: null,
      membershipUuid: null,
      workspaceRole: null,
      tenantMeta: null,
      isAuthenticated: false,
      error: null,
    });
  },

  loadFromStorage: async () => {
    const hydrated = readHydratedAuthSnapshot();
    if (!hydrated.token) {
      return;
    }

    // Ensure synchronous hydration even when tests populate localStorage after
    // store creation, without clobbering an already-loaded `user` object.
    set((prev) => ({
      user: prev.user ?? hydrated.user,
      token: hydrated.token,
      refreshToken: hydrated.refreshToken,
      tenantUuid: prev.tenantUuid ?? hydrated.tenantUuid,
      tenantId: prev.tenantId ?? hydrated.tenantId,
      tenantSlug: prev.tenantSlug ?? hydrated.tenantSlug,
      membershipUuid: prev.membershipUuid ?? hydrated.membershipUuid,
      workspaceRole: prev.workspaceRole ?? hydrated.workspaceRole,
      tenantMeta: prev.tenantMeta ?? hydrated.tenantMeta,
      isAuthenticated: true,
    }));

    const expectedToken = hydrated.token;
    try {
      const me = await fetchMe();
      // Ignore stale response if the user signed out or switched accounts while
      // `fetchMe()` was in flight.
      const currentToken = safeGetItem("@token") ?? get().token;
      if (currentToken !== expectedToken) return;

      persistUserSnapshot(me);
      const latest = get();
      set({
        user: me,
        token: currentToken,
        refreshToken: latest.refreshToken ?? safeGetItem("@refreshToken"),
        tenantUuid: latest.tenantUuid ?? safeGetItem("@tenantUuid"),
        tenantId: latest.tenantId ?? safeGetItem("@tenantId"),
        tenantSlug: latest.tenantSlug ?? safeGetItem("@tenantSlug"),
        membershipUuid: latest.membershipUuid ?? safeGetItem("@membershipUuid"),
        workspaceRole: latest.workspaceRole ?? safeGetItem("@workspaceRole"),
        tenantMeta: latest.tenantMeta ?? {
          logo: safeGetItem("@tenantLogo"),
          requestUrlName: safeGetItem("@tenantRequestUrlName"),
          checkinCode: safeGetItem("@tenantCheckinCode"),
        },
        isAuthenticated: true,
      });
    } catch (err) {
      const error = err as Error;
      console.error("Error loading user from storage:", error.message);
      safeRemoveItem("@token");
      safeRemoveItem("@refreshToken");
      safeRemoveItem(USER_SNAPSHOT_KEY);
      clearCachedLegalAcceptance();
      set({
        user: null,
        token: null,
        refreshToken: null,
        tenantUuid: null,
        tenantSlug: null,
        tenantMeta: null,
        tenantId: null,
        isAuthenticated: false,
      });
    }
  },

  setTenant: (
    tenantUuid: string,
    tenantId: string,
    logo?: string | null,
    requestUrlName?: string | null,
    tenantSlug?: string | null,
    checkinCode?: string | null
  ) => {
    safeSetItem("@tenantUuid", tenantUuid);
    safeSetItem("@tenantId", tenantId);
    if (tenantSlug) {
      safeSetItem("@tenantSlug", tenantSlug);
    } else {
      safeRemoveItem("@tenantSlug");
    }

    if (logo) safeSetItem("@tenantLogo", logo);
    else safeRemoveItem("@tenantLogo");
    if (requestUrlName) safeSetItem("@tenantRequestUrlName", requestUrlName);
    else safeRemoveItem("@tenantRequestUrlName");
    if (checkinCode) safeSetItem("@tenantCheckinCode", checkinCode);
    else safeRemoveItem("@tenantCheckinCode");

    set({
      tenantUuid,
      tenantId,
      tenantSlug: tenantSlug ?? null,
      tenantMeta: {
        logo,
        requestUrlName,
        checkinCode,
      },
    });
  },

  setWorkspaceMembership: (membershipUuid, workspaceRole = null) => {
    if (membershipUuid) {
      safeSetItem("@membershipUuid", membershipUuid);
    } else {
      safeRemoveItem("@membershipUuid");
    }
    if (workspaceRole) {
      safeSetItem("@workspaceRole", workspaceRole);
    } else {
      safeRemoveItem("@workspaceRole");
    }
    set({
      membershipUuid,
      workspaceRole: workspaceRole ?? null,
    });
  },

  clearTenant: () => {
    safeRemoveItem("@tenantUuid");
    safeRemoveItem("@tenantId");
    safeRemoveItem("@tenantSlug");
    safeRemoveItem("@membershipUuid");
    safeRemoveItem("@workspaceRole");
    safeRemoveItem("@tenantLogo");
    safeRemoveItem("@tenantRequestUrlName");
    safeRemoveItem("@tenantCheckinCode");

    set({
      tenantUuid: null,
      tenantId: null,
      tenantSlug: null,
      membershipUuid: null,
      workspaceRole: null,
      tenantMeta: null,
    });
  },

  setTenantUuid: (uuid) => {
    const prevUuid = useAuthStore.getState().tenantUuid;
    if (uuid) {
      safeSetItem("@tenantUuid", uuid);
    } else {
      safeRemoveItem("@tenantUuid");
    }

    if (uuid !== prevUuid) {
      safeRemoveItem("@tenantId");
      safeRemoveItem("@tenantSlug");
      safeRemoveItem("@tenantLogo");
      safeRemoveItem("@tenantRequestUrlName");
      safeRemoveItem("@tenantCheckinCode");
      set({
        tenantUuid: uuid,
        tenantId: null,
        tenantSlug: null,
        tenantMeta: null,
      });
      return;
    }

    set({ tenantUuid: uuid });
  },

  setTenantId: (id) => {
    if (id) {
      safeSetItem("@tenantId", id);
    } else {
      safeRemoveItem("@tenantId");
    }

    set({ tenantId: id });
  },

  setRefreshToken: (token) => {
    safeSetItem("@refreshToken", token);
    set({ refreshToken: token });
  },
}));
