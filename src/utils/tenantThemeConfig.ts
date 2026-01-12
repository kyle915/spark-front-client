export type TenantColorScheme = "light" | "dark";

export const TENANT_THEME_VARIABLES = [
  "--color-base-100",
  "--color-base-200",
  "--color-base-300",
  "--color-base-content",
  "--color-primary",
  "--color-primary-content",
  "--color-secondary",
  "--color-secondary-content",
  "--color-accent",
  "--color-accent-content",
  "--color-neutral",
  "--color-neutral-content",
  "--color-info",
  "--color-info-content",
  "--color-success",
  "--color-success-content",
  "--color-warning",
  "--color-warning-content",
  "--color-error",
  "--color-error-content",
] as const;

export type TenantThemeVariableKey = (typeof TENANT_THEME_VARIABLES)[number];

export const TENANT_THEME_LABELS: Record<TenantThemeVariableKey, string> = {
  "--color-base-100": "Base Color One",
  "--color-base-200": "Base Color Two",
  "--color-base-300": "Base Color Three",
  "--color-base-content": "Base Content Color",
  "--color-primary": "Primary Color",
  "--color-primary-content": "Primary Content Color",
  "--color-secondary": "Secondary Color",
  "--color-secondary-content": "Secondary Content Color",
  "--color-accent": "Accent Color",
  "--color-accent-content": "Accent Content Color",
  "--color-neutral": "Neutral Color",
  "--color-neutral-content": "Neutral Content Color",
  "--color-info": "Info Color",
  "--color-info-content": "Info Content Color",
  "--color-success": "Success Color",
  "--color-success-content": "Success Content Color",
  "--color-warning": "Warning Color",
  "--color-warning-content": "Warning Content Color",
  "--color-error": "Error Color",
  "--color-error-content": "Error Content Color",
};

export type CssVariablesMap = Record<string, string>;

export interface TenantThemeLike {
  name?: string | null;
  colorScheme?: string | null;
  cssVariables?: CssVariablesMap | null;
}

export const mapTenantColorSchemeToEnum = (
  colorScheme: TenantColorScheme
): "DARK" | "LIGHT" => (colorScheme === "light" ? "LIGHT" : "DARK");

export const DEFAULT_DARK_THEME_CSS_VARIABLES: CssVariablesMap = {
  "--color-base-100": "oklch(14% 0 0)",
  "--color-base-200": "oklch(20% 0 0)",
  "--color-base-300": "oklch(26% 0 0)",
  "--color-base-content": "oklch(97% 0 0)",
  "--color-primary": "oklch(88.7% 0.182 95.352)",
  "--color-primary-content": "oklch(24.3% 0.049 266.472)",
  "--color-secondary": "oklch(100% 0 0)",
  "--color-secondary-content": "oklch(76.7% 0.140 91.177)",
  "--color-accent": "hsl(358, 96%, 42%)",
  "--color-accent-content": "hsl(358, 93%, 94%)",
  "--color-neutral": "oklch(24.3% 0.049 266.472)",
  "--color-neutral-content": "oklch(76.7% 0.140 91.177)",
  "--color-info": "hsl(246, 60%, 42%)",
  "--color-info-content": "hsl(247, 61% , 80%)",
  "--color-success": "oklch(59% 0.145 163.225)",
  "--color-success-content": "oklch(97% 0.021 166.113)",
  "--color-warning": "hsl( 35, 96% , 50% )",
  "--color-warning-content": "hsl(36, 96%, 20%)",
  "--color-error": "oklch(41.2% 0.154 9.509)",
  "--color-error-content": "hsl( 358, 100%, 80%)",
};

export const DEFAULT_LIGHT_THEME_CSS_VARIABLES: CssVariablesMap = {
  "--color-base-100": "oklch(100% 0 0)",
  "--color-base-200": "oklch(98% 0 0)",
  "--color-base-300": "oklch(95% 0 0)",
  "--color-base-content": "oklch(21% 0.006 285.885)",
  "--color-primary": "oklch(76.7% 0.140 91.177)",
  "--color-primary-content": "hsl(45, 65%, 90%)",
  "--color-secondary": "oklch(14% 0 0)",
  "--color-secondary-content": "oklch(88.7% 0.182 95.352)",
  "--color-accent": "hsl( 274 , 99% , 31% )",
  "--color-accent-content": "oklch(88.5% 0.075 309.650)",
  "--color-neutral": "oklch(24.3% 0.049 266.472)",
  "--color-neutral-content": "hsl( 46 , 65% , 52% )",
  "--color-info": "oklch(63.2% 0.202 254.088)",
  "--color-info-content": "hsl( 208, 100%, 10%)",
  "--color-success": "hsl(109, 64% , 43% )",
  "--color-success-content": "hsl( 109 , 65% , 10% )",
  "--color-warning": "hsl(31, 100%, 47%)",
  "--color-warning-content": "hsl(31, 100%, 94%)",
  "--color-error": "hsl(358, 100% , 64% )",
  "--color-error-content": "oklch(27% 0.105 12.094)",
};

export function buildThemeDefaults(
  colorScheme: TenantColorScheme,
  apiTheme?: TenantThemeLike | null
): CssVariablesMap {
  const base =
    colorScheme === "dark"
      ? DEFAULT_DARK_THEME_CSS_VARIABLES
      : DEFAULT_LIGHT_THEME_CSS_VARIABLES;

  const merged: CssVariablesMap = {
    ...base,
    ...(apiTheme?.cssVariables ?? {}),
  };

  TENANT_THEME_VARIABLES.forEach((key) => {
    if (!merged[key]) {
      merged[key] = base[key] ?? "";
    }
  });

  return merged;
}

export function applyCssVariables(vars: CssVariablesMap) {
  const root = document.documentElement;

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
