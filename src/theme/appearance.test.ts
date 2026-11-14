import { beforeEach, describe, expect, it } from "vitest";
import { APPEARANCE_ATTR, holdAppearance } from "./appearance";

// No DOM in this test run: stand in for <html> and localStorage.
const attrs = new Map<string, string>();
const saved = new Map<string, string>();
Object.assign(globalThis, {
  document: {
    documentElement: {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => attrs.delete(k),
      getAttribute: (k: string) => attrs.get(k) ?? null,
    },
  },
  localStorage: {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => saved.set(k, v),
    clear: () => saved.clear(),
  },
});

const mode = () => document.documentElement.getAttribute(APPEARANCE_ATTR);

describe("holdAppearance", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(APPEARANCE_ATTR);
  });

  it("stays light when the old shell leaves after the new one arrived", () => {
    const signInShell = holdAppearance();
    const nextShell = holdAppearance();
    signInShell();
    expect(mode()).toBe("light");
    nextShell();
    expect(mode()).toBeNull();
  });

  it("ignores a second release from the same shell", () => {
    const a = holdAppearance();
    const b = holdAppearance();
    a();
    a();
    expect(mode()).toBe("light");
    b();
  });

  it("keeps an explicit dark choice", () => {
    localStorage.setItem("@spark.appearance", "dark");
    const release = holdAppearance();
    expect(mode()).toBeNull();
    release();
  });
});
