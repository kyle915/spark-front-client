import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { QUERY_PUBLIC_TENANT_THEME } from "@/public/api/queries/PublicThemeTenant.query";

import {
  buildThemeDefaults,
  applyCssVariables,
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
  tenantThemePublic: TenantThemePublic | null;
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
   * Fetch Theme (optional)
   * ===================================================== */
  useEffect(() => {
    if (!slug || !enabled) {
      setTheme(null);
      return;
    }

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
          setTheme(null); // ⬅️ fallback garantizado
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
   * Apply Theme (SIEMPRE)
   * ===================================================== */
  useEffect(() => {
    const effectiveColorScheme = theme?.colorScheme ?? colorScheme;

    const cssVariables = buildThemeDefaults(effectiveColorScheme, theme);

    // Browser native color scheme
    document.documentElement.setAttribute("color-scheme", effectiveColorScheme);

    // DaisyUI / Tailwind variables
    applyCssVariables(cssVariables);
  }, [theme, colorScheme]);

  return {
    theme,
    loading,
    error,
  };
}

export default useTenantTheme;
