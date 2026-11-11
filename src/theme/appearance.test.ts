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
  it("defaults to dark", () => {
    expect(readAppearance()).toBe("dark");
    expect(isLightMode()).toBe(false);
  });

  it("remembers and applies light", () => {
    setAppearance("light");
    expect(readAppearance()).toBe("light");
    expect(document.documentElement.getAttribute(APPEARANCE_ATTR)).toBe("light");
    expect(isLightMode()).toBe(true);
  });

  it("going back to dark removes the attribute and the stored choice", () => {
    setAppearance("light");
    setAppearance("dark");
    expect(readAppearance()).toBe("dark");
    expect(document.documentElement.hasAttribute(APPEARANCE_ATTR)).toBe(false);
  });

  it("applyAppearance does not persist", () => {
    applyAppearance("light");
    expect(readAppearance()).toBe("dark");
  });
});
