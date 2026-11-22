import { create } from "zustand";
import { login as loginService } from "@api/auth/login";
import { fetchMe, type MeUser } from "@api/auth/me";
import { themes } from "@/utils";
import { resetHotRelayDataPrefetch } from "@/lib/prefetchHotRelayData";

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
  loadFromStorage: () => void;
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

export const useAuthStore = create<AuthState>((set) => ({
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
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const { token } = await loginService(username, password);
      const authToken = token.token;
      const refreshToken = token.refreshToken;
      localStorage.setItem("@token", authToken);
      if (refreshToken) {
        localStorage.setItem("@refreshToken", refreshToken);
      }
      localStorage.removeItem("@tenantUuid");
      localStorage.removeItem("@tenantSlug");
      const me = await fetchMe();

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
      localStorage.setItem("@token", token);
      if (refreshToken) {
        localStorage.setItem("@refreshToken", refreshToken);
      }
      localStorage.removeItem("@tenantUuid");
      localStorage.removeItem("@tenantSlug");
      const me = await fetchMe();

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
    localStorage.removeItem("@token");
    localStorage.removeItem("@refreshToken");

    localStorage.removeItem("@tenantUuid");
    localStorage.removeItem("@tenantId");
    localStorage.removeItem("@tenantSlug");
    localStorage.removeItem("@membershipUuid");
    localStorage.removeItem("@workspaceRole");
    localStorage.removeItem("@tenantLogo");
    localStorage.removeItem("@tenantRequestUrlName");
    localStorage.removeItem("@tenantCheckinCode");

    // Allow idle Relay warmup again after the next login.
    resetHotRelayDataPrefetch();

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
    const token = localStorage.getItem("@token");
    const refreshToken = localStorage.getItem("@refreshToken");
    const tenantUuid = localStorage.getItem("@tenantUuid");
    const tenantId = localStorage.getItem("@tenantId");
    const tenantSlugFromStorage = localStorage.getItem("@tenantSlug");
    const membershipUuid = localStorage.getItem("@membershipUuid");
    const workspaceRole = localStorage.getItem("@workspaceRole");
    const logo = localStorage.getItem("@tenantLogo");
    const requestUrlName = localStorage.getItem("@tenantRequestUrlName");
    const checkinCode = localStorage.getItem("@tenantCheckinCode");

    const theme = localStorage.getItem("@theme") || themes.light;
    document.documentElement.setAttribute("data-theme", theme);
    if (token) {
      try {
        const me = await fetchMe();
        set({
          user: me,
          token,
          refreshToken,
          tenantUuid,
          tenantSlug: tenantSlugFromStorage,
          membershipUuid,
          workspaceRole,
          isAuthenticated: true,
          tenantId,
          tenantMeta: {
            logo,
            requestUrlName,
            checkinCode,
          },
        });
      } catch (err) {
        const error = err as Error;
        console.error("Error loading user from storage:", error.message);
        localStorage.removeItem("@token");
        localStorage.removeItem("@refreshToken");
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
    localStorage.setItem("@tenantUuid", tenantUuid);
    localStorage.setItem("@tenantId", tenantId);
    if (tenantSlug) {
      localStorage.setItem("@tenantSlug", tenantSlug);
    } else {
      localStorage.removeItem("@tenantSlug");
    }

    if (logo) localStorage.setItem("@tenantLogo", logo);
    else localStorage.removeItem("@tenantLogo");
    if (requestUrlName)
      localStorage.setItem("@tenantRequestUrlName", requestUrlName);
    else localStorage.removeItem("@tenantRequestUrlName");
    if (checkinCode) localStorage.setItem("@tenantCheckinCode", checkinCode);
    else localStorage.removeItem("@tenantCheckinCode");

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
      localStorage.setItem("@membershipUuid", membershipUuid);
    } else {
      localStorage.removeItem("@membershipUuid");
    }
    if (workspaceRole) {
      localStorage.setItem("@workspaceRole", workspaceRole);
    } else {
      localStorage.removeItem("@workspaceRole");
    }
    set({
      membershipUuid,
      workspaceRole: workspaceRole ?? null,
    });
  },

  clearTenant: () => {
    localStorage.removeItem("@tenantUuid");
    localStorage.removeItem("@tenantId");
    localStorage.removeItem("@tenantSlug");
    localStorage.removeItem("@membershipUuid");
    localStorage.removeItem("@workspaceRole");
    localStorage.removeItem("@tenantLogo");
    localStorage.removeItem("@tenantRequestUrlName");
    localStorage.removeItem("@tenantCheckinCode");

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
      localStorage.setItem("@tenantUuid", uuid);
    } else {
      localStorage.removeItem("@tenantUuid");
    }

    if (uuid !== prevUuid) {
      localStorage.removeItem("@tenantId");
      localStorage.removeItem("@tenantSlug");
      localStorage.removeItem("@tenantLogo");
      localStorage.removeItem("@tenantRequestUrlName");
      localStorage.removeItem("@tenantCheckinCode");
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
      localStorage.setItem("@tenantId", id);
    } else {
      localStorage.removeItem("@tenantId");
    }

    set({ tenantId: id });
  },

  setRefreshToken: (token) => {
    localStorage.setItem("@refreshToken", token);
    set({ refreshToken: token });
  },
}));
