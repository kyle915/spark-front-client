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

  "--radius-selector",
  "--radius-field",
  "--radius-box",
  "--size-selector",
  "--size-field",
  "--border",
  "--depth",
  "--noise",
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

  "--radius-selector": "Selector Radius",
  "--radius-field": "Field Radius",
  "--radius-box": "Box Radius",
  "--size-selector": "Selector Size",
  "--size-field": "Field Size",
  "--border": "Border Width",
  "--depth": "Elevation Depth",
  "--noise": "Noise Level",
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
  "--color-base-100": "oklch(16.0% 0.040 264.7)",
  "--color-base-200": "oklch(0% 0 0)",
  "--color-base-300": "oklch(21.4% 0.028 261.7)",
  "--color-base-content": "#EEEEEE",
  "--color-primary": "#12439B",
  "--color-primary-content": "oklch(88.34% 0.019 251.473)",
  "--color-secondary": "oklch(64.092% 0.027 229.389)",
  "--color-secondary-content": "oklch(12.818% 0.005 229.389)",
  "--color-accent": "#9442E6",
  "--color-accent-content": "oklch(13.454% 0.033 35.791)",
  "--color-neutral": "oklch(27.441% 0.013 253.041)",
  "--color-neutral-content": "#EEEEEE",
  "--color-info": "oklch(62.616% 0.143 240.033)",
  "--color-info-content": "oklch(12.523% 0.028 240.033)",
  "--color-success": "#C0E430",
  "--color-success-content": "oklch(14.045% 0.018 156.596)",
  "--color-warning": "#E86431",
  "--color-warning-content": "oklch(15.496% 0.023 81.519)",
  "--color-error": "#DC142C",
  "--color-error-content": "oklch(90.322% 0.029 29.674)",

  // 🎨 Layout
  "--radius-selector": "0rem",
  "--radius-field": "1rem",
  "--radius-box": "1rem",
  "--size-selector": "0.25rem",
  "--size-field": "0.25rem",
  "--border": "1px",
  "--depth": "1",
  "--noise": "0",
};

export const DEFAULT_LIGHT_THEME_CSS_VARIABLES: CssVariablesMap = {
  "--color-base-100": "oklch(98% 0 0)",
  "--color-base-200": "oklch(96% 0.001 286.375)",
  "--color-base-300": "oklch(92.0% 0.000 286.3)",
  "--color-base-content": "oklch(27% 0.006 286.033)",
  "--color-primary": "oklch(80% 0.114 19.571)",
  "--color-primary-content": "oklch(27% 0.006 286.033)",
  "--color-secondary": "oklch(78% 0.115 274.713)",
  "--color-secondary-content": "oklch(0% 0 0)",
  "--color-accent": "oklch(70% 0.183 293.541)",
  "--color-accent-content": "oklch(27% 0.006 286.033)",
  "--color-neutral": "oklch(78% 0.115 274.713)",
  "--color-neutral-content": "oklch(100% 0 0)",
  "--color-info": "oklch(73.0% 0.196 266.3)",
  "--color-info-content": "oklch(27% 0.006 286.033)",
  "--color-success": "oklch(88.0% 0.106 124.3)",
  "--color-success-content": "oklch(27% 0.006 286.033)",
  "--color-warning": "#E86431",
  "--color-warning-content": "oklch(27% 0.006 286.033)",
  "--color-error": "#DC142C",
  "--color-error-content": "oklch(98% 0.001 106.423)",

  "--radius-selector": "0rem",
  "--radius-field": "1rem",
  "--radius-box": "1rem",
  "--size-selector": "0.25rem",
  "--size-field": "0.25rem",
  "--border": "1px",
  "--depth": "0",
  "--noise": "0",
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
