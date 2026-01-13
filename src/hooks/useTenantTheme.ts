import { useEffect } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantThemeQuery } from "@/api/queries/TenantThemeQuery";
import type { TenantThemeQuery as TenantThemeQueryType } from "@api/queries/__generated__/TenantThemeQuery.graphql";

import {
  buildThemeDefaults,
  applyCssVariables,
  mapTenantColorSchemeToEnum,
  type TenantColorScheme,
} from "@/utils/tenantThemeConfig";

type UseTenantThemeOptions = {
  tenantId: string | null | undefined;
  colorScheme?: TenantColorScheme;
  enabled?: boolean;
};

export const useTenantTheme = ({
  tenantId,
  colorScheme = "dark",
  enabled = true,
}: UseTenantThemeOptions) => {
  const shouldFetch = Boolean(tenantId) && enabled;

  const colorSchemeEnum = mapTenantColorSchemeToEnum(colorScheme);

  const data = useLazyLoadQuery<TenantThemeQueryType>(
    TenantThemeQuery,
    {
      tenantId: tenantId ?? "",
      scheme: colorSchemeEnum,
    },
    {
      fetchPolicy: "store-or-network",
    }
  );

  const theme = shouldFetch ? data.tenantTheme : null;

  /* =====================================================
   * Apply Theme (SIEMPRE)
   * ===================================================== */
  useEffect(() => {
    const effectiveColorScheme =
      (theme?.colorScheme as TenantColorScheme) ?? colorScheme;

    const cssVariables = buildThemeDefaults(effectiveColorScheme, theme);

    // Browser native hint (scrollbars, inputs, etc.)
    document.documentElement.setAttribute("color-scheme", effectiveColorScheme);

    // DaisyUI / Tailwind
    applyCssVariables(cssVariables);
  }, [theme, colorScheme]);

  return {
    theme,
  };
};

export default useTenantTheme;
