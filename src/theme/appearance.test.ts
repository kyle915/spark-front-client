import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPEARANCE_ATTR,
  applyAppearance,
  isLightMode,
  readAppearance,
  setAppearance,
} from "./appearance";

// No DOM in this test run: stand in the three globals the module touches.
beforeEach(() => {
  const store = new Map<string, string>();
  const attrs = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("document", {
    documentElement: {
      getAttribute: (k: string) => attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
      hasAttribute: (k: string) => attrs.has(k),
    },
  });
  vi.stubGlobal("window", { dispatchEvent: () => true });
  vi.stubGlobal("Event", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appearance", () => {
  it("defaults to light until someone chooses", () => {
    expect(readAppearance()).toBe("light");
  });

  it("remembers and applies light", () => {
    setAppearance("light");
    expect(readAppearance()).toBe("light");
    expect(document.documentElement.getAttribute(APPEARANCE_ATTR)).toBe("light");
    expect(isLightMode()).toBe(true);
  });

  it("choosing dark is remembered and removes the light attribute", () => {
    setAppearance("light");
    setAppearance("dark");
    expect(readAppearance()).toBe("dark");
    expect(document.documentElement.hasAttribute(APPEARANCE_ATTR)).toBe(false);
  });

  it("applyAppearance does not persist", () => {
    setAppearance("dark");
    applyAppearance("light");
    expect(readAppearance()).toBe("dark");
  });
});
