import { create } from 'zustand';
import { login as loginService } from '@api/auth/login';
import { fetchMe, type MeUser } from '@api/auth/me';
import { themes } from "@utils";

interface AuthState {
    user: MeUser | null;
    token: string | null;
    tenantUuid: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
    login: (username: string, password: string) => Promise<void>;
    socialLogin: (token: string) => Promise<void>;
    logout: () => void;
    loadFromStorage: () => void;
    setTenantUuid: (uuid: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    tenantUuid: null,
    isAuthenticated: false,
    loading: false,
    error: null,

    login: async (username, password) => {
        set({ loading: true, error: null });
        try {
            const { token } = await loginService(username, password);
            const authToken = token.token;
            localStorage.setItem('@token', authToken);
            localStorage.removeItem('@tenantUuid');
            const me = await fetchMe();

            set({
                user: me,
                token: authToken,
                tenantUuid: null,
                isAuthenticated: true,
                loading: false,
            });
        } catch (err: any) {
            set({
                error: err.message || 'Error logging in',
                loading: false,
            });
        }
    },

    socialLogin: async (token: string) => {
        set({ loading: true, error: null });
        try {
            localStorage.setItem('@token', token);
            localStorage.removeItem('@tenantUuid');
            const me = await fetchMe();

            set({
                user: me,
                token,
                tenantUuid: null,
                isAuthenticated: true,
                loading: false,
            });
        } catch (err: any) {
            set({
                error: err.message || 'Error logging in',
                loading: false,
            });
        }
    },

    logout: () => {
        localStorage.removeItem('@token');
        localStorage.removeItem('@tenantUuid');
        set({
            user: null,
            token: null,
            tenantUuid: null,
            isAuthenticated: false,
            error: null,
        });
    },

    loadFromStorage: async () => {
        const token = localStorage.getItem('@token');
        const tenantUuid = localStorage.getItem('@tenantUuid');
        const theme = localStorage.getItem("@theme") || themes.light;
        document.documentElement.setAttribute("data-theme", theme);
        if (token) {
            try {
                const me = await fetchMe();
                set({ user: me, token, tenantUuid, isAuthenticated: true });
            } catch (err) {
                localStorage.removeItem('@token');
                set({ user: null, token: null, tenantUuid: null, isAuthenticated: false });
            }

        }

    },
    setTenantUuid: (uuid) => {
        if (uuid) {
            localStorage.setItem('@tenantUuid', uuid);
        } else {
            localStorage.removeItem('@tenantUuid');
        }

        set({ tenantUuid: uuid });
    },
}));
