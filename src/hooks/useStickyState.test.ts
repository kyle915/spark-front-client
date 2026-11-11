import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSticky, writeSticky } from "./useStickyState";

const oneOf =
  (allowed: readonly string[]) =>
  (raw: unknown): string | null =>
    typeof raw === "string" && allowed.includes(raw) ? raw : null;

describe("sticky state", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns the initial value when nothing is saved", () => {
    expect(readSticky("k", "90", oneOf(["30", "90"]))).toBe("90");
  });

  it("round-trips a saved value", () => {
    writeSticky("k", "30");
    expect(readSticky("k", "90", oneOf(["30", "90"]))).toBe("30");
  });

  it("ignores a saved value that is no longer valid", () => {
    writeSticky("k", "180");
    expect(readSticky("k", "90", oneOf(["30", "90"]))).toBe("90");
    store.set("k", "{not json");
    expect(readSticky("k", "90", oneOf(["30", "90"]))).toBe("90");
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(readSticky("k", "90", oneOf(["30", "90"]))).toBe("90");
    expect(() => writeSticky("k", "30")).not.toThrow();
  });
});
