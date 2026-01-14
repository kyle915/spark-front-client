import { create } from "zustand";
import { login as loginService } from "@api/auth/login";
import { fetchMe, type MeUser } from "@api/auth/me";
import { themes } from "@/utils";

interface AuthState {
  user: MeUser | null;
  token: string | null;
  refreshToken: string | null;
  tenantUuid: string | null;
  tenantId: string | null;
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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  tenantUuid: null,
  tenantId: null,
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
      const me = await fetchMe();

      set({
        user: me,
        token: authToken,
        refreshToken,
        tenantUuid: null,
        isAuthenticated: true,
        loading: false,
      });
    } catch (err) {
      const error = err as Error;
      set({
        error: error.message || "Error logging in",
        loading: false,
      });
      throw error;
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
      const me = await fetchMe();

      set({
        user: me,
        token,
        refreshToken,
        tenantUuid: null,
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
    set({
      user: null,
      token: null,
      refreshToken: null,
      tenantUuid: null,
      isAuthenticated: false,
      error: null,
    });
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem("@token");
    const refreshToken = localStorage.getItem("@refreshToken");
    const tenantUuid = localStorage.getItem("@tenantUuid");
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
          isAuthenticated: true,
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
          isAuthenticated: false,
        });
      }
    }
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
