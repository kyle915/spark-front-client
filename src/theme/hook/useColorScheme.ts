import { useEffect, useState } from "react";
import type { TenantColorScheme } from "@utils/tenantThemeConfig";

/**
 * Mantiene una fuente única: el atributo del <html>.
 * Evita relecturas tardías de localStorage.
 */
export function useColorScheme(defaultValue: TenantColorScheme = "light") {
  const [colorScheme, setColorScheme] = useState<TenantColorScheme>(() => {
    const fromHtml = document.documentElement.getAttribute(
      "color-scheme"
    ) as TenantColorScheme | null;

    return fromHtml ?? defaultValue;
  });

  useEffect(() => {
    document.documentElement.setAttribute("color-scheme", colorScheme);
    localStorage.setItem("@color-scheme", colorScheme);
  }, [colorScheme]);

  return { colorScheme, setColorScheme };
}
