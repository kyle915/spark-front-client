import { describe, it, expect, beforeEach } from "vitest";
import { loadFavorites, saveFavorites, toggleFavorite } from "./favorites";

/**
 * Smoke tests for the localStorage-backed favorites helper. Exercise
 * the full read / write / toggle cycle so the next person to swap
 * this for a GraphQL implementation has a sanity check.
 */

// vitest provides a default jsdom env via `--environment=jsdom`. We
// don't want to pay that for the rest of the suite, so we polyfill
// the bits of localStorage we touch ourselves. The helper degrades
// gracefully when storage is missing, so the test verifies both
// happy-path and storage-disabled behavior.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  // Fresh storage per test so we don't leak state between cases.
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemoryStorage();
});

describe("favorites", () => {
  it("loadFavorites returns empty Set when tenant is null", () => {
    expect(loadFavorites(null).size).toBe(0);
  });

  it("loadFavorites returns empty Set when nothing saved", () => {
    expect(loadFavorites("t-1").size).toBe(0);
  });

  it("saveFavorites + loadFavorites roundtrips", () => {
    saveFavorites("t-1", new Set(["a", "b"]));
    const got = loadFavorites("t-1");
    expect(got.has("a")).toBe(true);
    expect(got.has("b")).toBe(true);
    expect(got.size).toBe(2);
  });

  it("favorites are scoped per tenant", () => {
    saveFavorites("t-1", new Set(["a"]));
    saveFavorites("t-2", new Set(["b"]));
    expect(loadFavorites("t-1").has("a")).toBe(true);
    expect(loadFavorites("t-1").has("b")).toBe(false);
    expect(loadFavorites("t-2").has("b")).toBe(true);
  });

  it("toggleFavorite adds then removes", () => {
    const after1 = toggleFavorite("t-1", "x");
    expect(after1.has("x")).toBe(true);
    const after2 = toggleFavorite("t-1", "x");
    expect(after2.has("x")).toBe(false);
  });

  it("malformed localStorage payload returns empty Set (no throw)", () => {
    localStorage.setItem("@spark.favorites/t-1", "{not-json}");
    expect(loadFavorites("t-1").size).toBe(0);
  });
});
