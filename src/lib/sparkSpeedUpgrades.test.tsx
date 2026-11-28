import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getWarmedHotRelayKey,
  hasWarmedIntentKey,
  markWarmedIntentKey,
  resetHotRelayDataPrefetch,
  setWarmedHotRelayKey,
} from "./hotRelayPrefetchState";
import {
  clearCachedLegalAcceptance,
  hasCachedLegalAcceptance,
  readCachedLegalAcceptance,
  writeCachedLegalAcceptance,
} from "@/legal/acceptance/legalAcceptanceCache";
import {
  directThumbUrl,
  handleThumbError,
  isPrivateMediaUrl,
  thumbSources,
  thumbUrl,
} from "@/utils/thumb";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Spark performance upgrades", () => {
  afterEach(() => {
    resetHotRelayDataPrefetch();
    vi.unstubAllGlobals();
  });

  it("evicts static hot-prefetch GraphQL ASTs and @/utils barrel from cold-boot entry modules", () => {
    const authStoreSrc = readSrc("src/store/authStore.ts");
    const envSrc = readSrc("src/api/relay/environment.ts");
    const appRouterSrc = readSrc("src/routes/AppRouter.tsx");
    const mainSrc = readSrc("src/main.tsx");

    expect(authStoreSrc).not.toContain("@/lib/prefetchHotRelayData");
    expect(authStoreSrc).toContain("@/lib/hotRelayPrefetchState");
    expect(authStoreSrc).toContain("@/theme/themes");
    expect(authStoreSrc).toContain("readHydratedAuthSnapshot");

    expect(envSrc).not.toContain("@/lib/prefetchHotRelayData");
    expect(envSrc).toContain("@/lib/hotRelayPrefetchState");

    expect(appRouterSrc).toContain('import("@/lib/prefetchHotRelayData")');
    expect(appRouterSrc).not.toMatch(
      /^import\s+.*prefetchHotRelayData.*from\s+["']@\/lib\/prefetchHotRelayData["']/m,
    );

    expect(mainSrc).toContain('import("./routes/routeChunkPrefetch")');
    expect(mainSrc).toContain("prefetchRouteChunk(pathname)");
  });

  it("resets both idle and pointer-intent warmup keys on logout or workspace switch", () => {
    setWarmedHotRelayKey("Tenant:1:admin");
    markWarmedIntentKey("Tenant:1:admin:/requests/list");
    expect(getWarmedHotRelayKey()).toBe("Tenant:1:admin");
    expect(hasWarmedIntentKey("Tenant:1:admin:/requests/list")).toBe(true);

    resetHotRelayDataPrefetch();
    expect(getWarmedHotRelayKey()).toBeNull();
    expect(hasWarmedIntentKey("Tenant:1:admin:/requests/list")).toBe(false);
  });

  it("caches per-user legal acceptance locally and invalidates across accounts", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });

    expect(hasCachedLegalAcceptance("UserNode:1")).toBe(false);
    writeCachedLegalAcceptance("UserNode:1", "2026-04-01");
    expect(hasCachedLegalAcceptance("UserNode:1")).toBe(true);
    expect(hasCachedLegalAcceptance("UserNode:2")).toBe(false);
    expect(readCachedLegalAcceptance()?.version).toBe("2026-04-01");

    clearCachedLegalAcceptance();
    expect(hasCachedLegalAcceptance("UserNode:1")).toBe(false);
  });

  it("rewrites public GCS URLs directly to thumbs/w{w}/{blob}.jpg while preserving HEIC/PDF/private-media safety", () => {
    const jpg =
      "https://storage.googleapis.com/sparkio-production/recaps/2026/photo-1.jpg";
    expect(directThumbUrl(jpg, 400)).toBe(
      "https://storage.googleapis.com/sparkio-production/thumbs/w400/recaps/2026/photo-1.jpg.jpg",
    );
    expect(directThumbUrl(jpg, 800)).toBe(
      "https://storage.googleapis.com/sparkio-production/thumbs/w800/recaps/2026/photo-1.jpg.jpg",
    );

    // Already-thumbed URLs are never double-prefixed.
    const alreadyThumbed = directThumbUrl(jpg, 400);
    expect(directThumbUrl(alreadyThumbed, 400)).toBe(alreadyThumbed);

    // Raw HEIC and PDF paths stay off direct thumb paths so API fallback handles them.
    const heic =
      "https://storage.googleapis.com/sparkio-production/recaps/IMG_9912.HEIC";
    expect(directThumbUrl(heic, 400)).toBe(thumbUrl(heic, 400));

    const pdf =
      "https://storage.googleapis.com/sparkio-production/recaps/pdfs/report.pdf";
    expect(directThumbUrl(pdf, 400)).toBe(thumbUrl(pdf, 400));

    // Private-media tokens keep using their signed ?w= endpoint.
    const priv = "https://api.test/api/public/media/o/k1.abc.def/IMG_1.jpg";
    expect(isPrivateMediaUrl(priv)).toBe(true);
    expect(directThumbUrl(priv, 400)).toBe(`${priv}?w=400`);

    // Candidate chain starts with direct GCS thumb and ends with full-res original.
    const chain = thumbSources(jpg, 400);
    expect(chain[0]).toBe(alreadyThumbed);
    expect(chain[chain.length - 1]).toBe(jpg);

    // Progressive error handler steps from direct thumb -> API thumb -> original.
    const fakeImg = {
      src: alreadyThumbed,
      dataset: {} as Record<string, string | undefined>,
    } as unknown as HTMLImageElement;
    handleThumbError(fakeImg, jpg, 400);
    expect(fakeImg.dataset.sparkThumbStep).toBe("1");
    handleThumbError(fakeImg, jpg, 400);
    expect(fakeImg.dataset.sparkThumbStep).toBe("2");
    expect(fakeImg.src).toBe(jpg);
  });

  it("lazy-splits InsightsBody on DashboardEvent and RecapForm on SparkCheckin", () => {
    const dashSrc = readSrc(
      "src/components/pages/dashboard-event/DashboardEvent.tsx",
    );
    expect(dashSrc).toContain("IntersectionObserver");
    expect(dashSrc).toContain("LazyInsightsBody");
    expect(dashSrc).not.toMatch(
      /^import\s+\{\s*InsightsBody\s*\}\s+from/m,
    );

    const checkinSrc = readSrc(
      "src/components/pages/checkin/SparkCheckin.tsx",
    );
    expect(checkinSrc).toContain('import("./RecapForm")');
    expect(checkinSrc).toContain("LazyRecapForm");
    expect(checkinSrc).not.toMatch(/^import\s+RecapForm\s+from/m);
  });
});
