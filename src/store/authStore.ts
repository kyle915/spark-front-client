import { create } from "zustand";
import { login as loginService } from "@api/auth/login";
import { fetchMe, type MeUser } from "@api/auth/me";
import { themes } from "@/utils";

type TenantMeta = {
  logo?: string | null;
  requestUrlName?: string | null;
};

interface AuthState {
  user: MeUser | null;
  token: string | null;
  refreshToken: string | null;
  tenantUuid: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
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
  setTenant: (
    tenantUuid: string,
    tenantId: string,
    logo?: string | null,
    requestUrlName?: string | null,
    tenantSlug?: string | null
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
      // Set token + isAuthenticated FIRST so any concurrent route guard
      // re-render (PrivateRoute reads @token, TenantGuard reads
      // store.user) sees the new session before fetchMe lands.
      // Otherwise a slow `me` query can leave the store in a half-state
      // where the token is in localStorage but the auth flag is false,
      // bouncing the user back to /login mid-flow.
      set({
        token,
        refreshToken,
        isAuthenticated: true,
      });
      let me: MeUser | null = null;
      try {
        me = await fetchMe();
      } catch (meErr) {
        // Profile fetch failed (most likely transient network or a
        // backend hiccup). The session is still valid — keep the token,
        // let the user proceed; TenantGuard will retry the tenant
        // bootstrap on the next render. Surface the message but don't
        // wipe the auth flag.
        const msg =
          (meErr as Error).message || "Could not load your profile.";
        // eslint-disable-next-line no-console
        console.warn("[auth] fetchMe failed after socialLogin:", msg);
      }
      set({
        user: me,
        // Don't blow away the last-used tenant on a fresh sign-in —
        // TenantGuard will re-validate against the user's tenant list
        // and either keep it (admin who switched tenants in the past)
        // or pick the first available.
        loading: false,
      });
    } catch (err) {
      const error = err as Error;
      // Hard failure (e.g. localStorage write blocked). Clear the
      // partial state so we don't loop back into a broken session.
      try {
        localStorage.removeItem("@token");
        localStorage.removeItem("@refreshToken");
      } catch {
        /* ignore */
      }
      set({
        token: null,
        refreshToken: null,
        isAuthenticated: false,
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
    localStorage.removeItem("@tenantLogo");
    localStorage.removeItem("@tenantRequestUrlName");

    set({
      user: null,
      token: null,
      refreshToken: null,
      tenantUuid: null,
      tenantId: null,
      tenantSlug: null,
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
    const logo = localStorage.getItem("@tenantLogo");
    const requestUrlName = localStorage.getItem("@tenantRequestUrlName");

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
          isAuthenticated: true,
          tenantId,
          tenantMeta: {
            logo,
            requestUrlName,
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
    tenantSlug?: string | null
  ) => {
    localStorage.setItem("@tenantUuid", tenantUuid);
    localStorage.setItem("@tenantId", tenantId);
    if (tenantSlug) {
      localStorage.setItem("@tenantSlug", tenantSlug);
    } else {
      localStorage.removeItem("@tenantSlug");
    }

    if (logo) localStorage.setItem("@tenantLogo", logo);
    if (requestUrlName)
      localStorage.setItem("@tenantRequestUrlName", requestUrlName);

    set({
      tenantUuid,
      tenantId,
      tenantSlug: tenantSlug ?? null,
      tenantMeta: {
        logo,
        requestUrlName,
      },
    });
  },

  clearTenant: () => {
    localStorage.removeItem("@tenantUuid");
    localStorage.removeItem("@tenantId");
    localStorage.removeItem("@tenantSlug");
    localStorage.removeItem("@tenantLogo");
    localStorage.removeItem("@tenantRequestUrlName");

    set({
      tenantUuid: null,
      tenantId: null,
      tenantSlug: null,
      tenantMeta: null,
    });
  },

  setTenantUuid: (uuid) => {
    if (uuid) {
      localStorage.setItem("@tenantUuid", uuid);
    } else {
      localStorage.removeItem("@tenantUuid");
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
