import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { QUERY_PUBLIC_TENANT_THEME } from "@/public/api/queries/PublicThemeTenant.query";

import {
  mapTenantColorSchemeToEnum,
  type TenantColorScheme,
} from "@/utils/tenantThemeConfig";

type UseTenantThemeOptions = {
  slug: string | null | undefined;
  colorScheme?: TenantColorScheme;
  enabled?: boolean;
};

export type TenantThemePublic = {
  id: string;
  name: string;
  colorScheme: "light" | "dark";
  cssVariables: Record<string, string>;
};

type TenantThemePublicResponse = {
  tenantThemePublic: TenantThemePublic;
};

export function useTenantTheme({
  slug,
  colorScheme = "dark",
  enabled = true,
}: UseTenantThemeOptions) {
  const [theme, setTheme] = useState<TenantThemePublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =====================================================
   * Fetch Theme
   * ===================================================== */
  useEffect(() => {
    if (!slug || !enabled) return;

    let isMounted = true;

    async function fetchTheme() {
      setLoading(true);
      setError(null);

      try {
        const result = await gqlRequest<TenantThemePublicResponse>(
          QUERY_PUBLIC_TENANT_THEME,
          {
            requestUrlName: slug,
            colorScheme: mapTenantColorSchemeToEnum(colorScheme),
          }
        );

        if (isMounted) {
          setTheme(result?.tenantThemePublic ?? null);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchTheme();

    return () => {
      isMounted = false;
    };
  }, [slug, colorScheme, enabled]);

  /* =====================================================
   * Apply CSS Variables
   * ===================================================== */
  useEffect(() => {
    if (!theme?.cssVariables) return;

    const root = document.documentElement;

    // HTML color-scheme (browser native)
    root.setAttribute("color-scheme", theme.colorScheme ?? colorScheme);

    Object.entries(theme.cssVariables).forEach(([key, value]) => {
      if (typeof value === "string") {
        root.style.setProperty(key, value);
      }
    });
  }, [theme, colorScheme]);

  return {
    theme,
    loading,
    error,
  };
}

export default useTenantTheme;
