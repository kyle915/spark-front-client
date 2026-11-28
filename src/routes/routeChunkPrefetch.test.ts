import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasRouteChunkPrefetch,
  normalizePrefetchPath,
  prefetchRouteChunk,
  resetPrefetchedRouteChunks,
} from "./routeChunkPrefetch";

describe("routeChunkPrefetch", () => {
  afterEach(() => {
    resetPrefetchedRouteChunks();
    vi.unstubAllGlobals();
  });

  it("normalizes query strings, hashes, and trailing slashes", () => {
    expect(normalizePrefetchPath("/")).toBe("/");
    expect(normalizePrefetchPath("/reports/?range=90#top")).toBe("/reports");
    expect(normalizePrefetchPath("/shelf-voice?tab=osa")).toBe("/shelf-voice");
    expect(normalizePrefetchPath("/account-map/")).toBe("/account-map");
  });

  it("covers key secondary navigation routes (Shelf & Voice, Reports, Buyer Report, Account Map)", () => {
    for (const path of [
      "/shelf-voice",
      "/reports",
      "/buyer-report",
      "/retailer-pos",
      "/demo-costs",
      "/roi-pacing",
      "/account-map",
      "/client-dashboard",
      "/my-approvals",
      "/approvals",
      "/requests/list",
      "/recaps/list",
    ]) {
      expect(hasRouteChunkPrefetch(path), path).toBe(true);
    }
  });

  it("deduplicates repeated hovers and retries after a transient failure", async () => {
    const okLoader = vi.fn().mockResolvedValue({});
    const flakyLoader = vi.fn().mockRejectedValueOnce(new Error("offline"));
    const table = {
      "/reports": okLoader,
      "/shelf-voice": flakyLoader,
    };

    expect(prefetchRouteChunk("/reports?range=30", table)).toBe(true);
    expect(prefetchRouteChunk("/reports", table)).toBe(false);
    expect(okLoader).toHaveBeenCalledTimes(1);

    // Failed prefetch removes itself from the dedupe set so a later hover retries.
    expect(prefetchRouteChunk("/shelf-voice", table)).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    flakyLoader.mockResolvedValueOnce({});
    expect(prefetchRouteChunk("/shelf-voice", table)).toBe(true);
    expect(flakyLoader).toHaveBeenCalledTimes(2);
  });

  it("respects browser Data Saver mode", () => {
    vi.stubGlobal("navigator", { connection: { saveData: true } });
    const loader = vi.fn().mockResolvedValue({});
    expect(prefetchRouteChunk("/reports", { "/reports": loader })).toBe(false);
    expect(loader).not.toHaveBeenCalled();
  });
});
