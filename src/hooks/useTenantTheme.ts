import { useEffect } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantThemeQuery } from "@/api/queries/TenantThemeQuery";
import type { TenantThemeQuery as TenantThemeQueryType } from "@api/queries/__generated__/TenantThemeQuery.graphql";
import {
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

  useEffect(() => {
    if (!theme?.cssVariables) return;

    const root = document.documentElement;
    root.setAttribute("color-scheme", colorScheme);

    Object.entries(theme.cssVariables).forEach(([key, value]) => {
      if (typeof value === "string") {
        root.style.setProperty(key, value);
      }
    });
  }, [theme, colorScheme]);

  return {
    theme,
  };
};

export default useTenantTheme;
