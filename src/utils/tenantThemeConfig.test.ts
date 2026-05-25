import { describe, it, expect } from "vitest";
import {
  buildThemeDefaults,
  mapTenantColorSchemeToEnum,
  DEFAULT_DARK_THEME_CSS_VARIABLES,
  DEFAULT_LIGHT_THEME_CSS_VARIABLES,
  TENANT_THEME_VARIABLES,
} from "./tenantThemeConfig";

/**
 * Smoke tests for theme variable resolution. Regressions here mean
 * tenants get wrong colors or fall back to broken defaults on dashboard
 * paint — easy to miss visually, easy to test cheaply.
 */

describe("mapTenantColorSchemeToEnum", () => {
  it("maps light/dark to LIGHT/DARK enums", () => {
    expect(mapTenantColorSchemeToEnum("light")).toBe("LIGHT");
    expect(mapTenantColorSchemeToEnum("dark")).toBe("DARK");
  });
});

describe("buildThemeDefaults", () => {
  it("returns dark defaults when no override and scheme=dark", () => {
    const out = buildThemeDefaults("dark", null);
    expect(out["--color-primary"]).toBe(
      DEFAULT_DARK_THEME_CSS_VARIABLES["--color-primary"],
    );
  });

  it("returns light defaults when no override and scheme=light", () => {
    const out = buildThemeDefaults("light", null);
    expect(out["--color-primary"]).toBe(
      DEFAULT_LIGHT_THEME_CSS_VARIABLES["--color-primary"],
    );
  });

  it("merges tenant overrides on top of defaults", () => {
    const out = buildThemeDefaults("dark", {
      cssVariables: { "--color-primary": "#ff0000" },
    });
    expect(out["--color-primary"]).toBe("#ff0000");
    // Other vars untouched.
    expect(out["--color-base-100"]).toBe(
      DEFAULT_DARK_THEME_CSS_VARIABLES["--color-base-100"],
    );
  });

  it("guarantees every documented variable is present", () => {
    const out = buildThemeDefaults("dark", null);
    for (const key of TENANT_THEME_VARIABLES) {
      expect(out[key]).toBeDefined();
    }
  });
});
