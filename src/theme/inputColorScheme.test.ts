import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APPEARANCE_ATTR } from "./appearance";
import { inputColorScheme } from "./inputColorScheme";

// No DOM in this test run: stand in the one global the helper reads.
const attrs = new Map<string, string>();
beforeEach(() => {
  attrs.clear();
  vi.stubGlobal("document", {
    documentElement: { getAttribute: (k: string) => attrs.get(k) ?? null },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("inputColorScheme", () => {
  it("is dark outside the signed-in shell, where no appearance is set", () => {
    expect(inputColorScheme()).toBe("dark");
  });

  it("follows the shell into light mode", () => {
    attrs.set(APPEARANCE_ATTR, "light");
    expect(inputColorScheme()).toBe("light");
  });

  it("is dark with no document at all", () => {
    vi.unstubAllGlobals();
    expect(inputColorScheme()).toBe("dark");
  });
});
