import { useEffect, useState } from "react";
import { executeAuthenticatedGraphQL } from "@/api/relay/environment";
import { recapFileKind } from "@/utils/recapFileUrl";
import { thumbUrl } from "@/utils/thumb";

export interface QuickPeekPhoto {
  url: string;
  thumb: string;
  label: string;
  category: string;
}

type CustomPhotosPayload = {
  customRecap?: {
    customRecapFiles?: ReadonlyArray<{
      url?: string | null;
      displayUrl?: string | null;
      name?: string | null;
      fileRecapCategory?: { name?: string | null } | null;
    } | null> | null;
  } | null;
};

type LegacyPhotosPayload = {
  recap?: {
    recapFiles?: ReadonlyArray<{
      file?: string | null;
      displayUrl?: string | null;
      name?: string | null;
      fileRecapCategory?: { name?: string | null } | null;
    } | null> | null;
  } | null;
};

const CUSTOM_PHOTOS_QUERY = `
  query QuickPeekCustomRecapPhotos($uuid: ID) {
    customRecap(uuid: $uuid) {
      customRecapFiles {
        url
        displayUrl
        name
        fileRecapCategory {
          name
        }
      }
    }
  }
`;

const LEGACY_PHOTOS_QUERY = `
  query QuickPeekLegacyRecapPhotos($uuid: ID!) {
    recap(uuid: $uuid) {
      recapFiles {
        file
        displayUrl
        name
        fileRecapCategory {
          name
        }
      }
    }
  }
`;

const photoCache = new Map<string, QuickPeekPhoto[]>();

function rememberCachedPhotos(cacheKey: string, items: QuickPeekPhoto[]): void {
  if (photoCache.size >= 120) {
    const oldest = photoCache.keys().next().value;
    if (oldest) photoCache.delete(oldest);
  }
  photoCache.set(cacheKey, items);
}

function normalizePhotos(
  rawItems: Array<{
    rawUrl: string;
    displayUrl: string;
    name: string;
    category: string;
  }>,
  heroUrl: string | null,
  fallbackName: string,
): QuickPeekPhoto[] {
  const seen = new Set<string>();
  const out: QuickPeekPhoto[] = [];

  if (heroUrl && recapFileKind(heroUrl) !== "video") {
    seen.add(heroUrl);
    out.push({
      url: thumbUrl(heroUrl, 800) || heroUrl,
      thumb: thumbUrl(heroUrl, 400) || heroUrl,
      label: fallbackName,
      category: "",
    });
  }

  for (const item of rawItems) {
    const checkUrl = item.rawUrl || item.displayUrl;
    if (!checkUrl || recapFileKind(checkUrl) === "video") continue;
    const renderUrl = item.displayUrl || item.rawUrl;
    if (!renderUrl) continue;
    // Update category/label on hero if it matches
    if (seen.has(renderUrl) || seen.has(item.rawUrl)) {
      const heroMatch = out[0];
      if (heroMatch && !heroMatch.category && item.category) {
        heroMatch.category = item.category;
      }
      continue;
    }
    seen.add(renderUrl);
    if (item.rawUrl) seen.add(item.rawUrl);
    out.push({
      url: thumbUrl(renderUrl, 800) || renderUrl,
      thumb: thumbUrl(renderUrl, 400) || renderUrl,
      label: item.name || item.category || fallbackName,
      category: item.category,
    });
  }

  return out;
}

export function useQuickPeekPhotos(
  recap: {
    uuid: string;
    kind: "legacy" | "custom";
    name: string;
    heroImage: string | null;
    fileCount: number;
  } | null,
  open: boolean,
): { photos: QuickPeekPhoto[]; loadingPhotos: boolean } {
  const recapUuid = recap?.uuid ?? "";
  const recapKind = recap?.kind ?? "custom";
  const recapFileCount = recap?.fileCount ?? 0;
  const recapHeroImage = recap?.heroImage ?? null;
  const recapName = recap?.name ?? "";
  const cacheKey = recap ? `${recapKind}:${recapUuid}` : "";
  const [fetched, setFetched] = useState<{
    key: string;
    items: QuickPeekPhoto[];
  } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !recapUuid || recapFileCount <= 1) return;
    const key = `${recapKind}:${recapUuid}`;
    const cached = photoCache.get(key);
    if (cached) {
      setFetched({ key, items: cached });
      return;
    }

    let cancelled = false;
    setLoadingKey(key);

    const load = async () => {
      try {
        if (recapKind === "custom") {
          const res = await executeAuthenticatedGraphQL<CustomPhotosPayload>(
            CUSTOM_PHOTOS_QUERY,
            { uuid: recapUuid },
            { operationKind: "query" },
          );
          if (cancelled) return;
          const files = res.data?.customRecap?.customRecapFiles ?? [];
          const normalized = normalizePhotos(
            files
              .filter((f): f is NonNullable<typeof f> => Boolean(f))
              .map((f) => ({
                rawUrl: (f.url ?? "").trim(),
                displayUrl: (f.displayUrl ?? f.url ?? "").trim(),
                name: (f.name ?? "").trim(),
                category: (f.fileRecapCategory?.name ?? "").trim(),
              })),
            recapHeroImage,
            recapName,
          );
          rememberCachedPhotos(key, normalized);
          setFetched({ key, items: normalized });
        } else {
          const res = await executeAuthenticatedGraphQL<LegacyPhotosPayload>(
            LEGACY_PHOTOS_QUERY,
            { uuid: recapUuid },
            { operationKind: "query" },
          );
          if (cancelled) return;
          const files = res.data?.recap?.recapFiles ?? [];
          const normalized = normalizePhotos(
            files
              .filter((f): f is NonNullable<typeof f> => Boolean(f))
              .map((f) => ({
                rawUrl: (f.file ?? "").trim(),
                displayUrl: (f.displayUrl ?? f.file ?? "").trim(),
                name: (f.name ?? "").trim(),
                category: (f.fileRecapCategory?.name ?? "").trim(),
              })),
            recapHeroImage,
            recapName,
          );
          rememberCachedPhotos(key, normalized);
          setFetched({ key, items: normalized });
        }
      } catch {
        // Keep hero image fallback silently on network error.
      } finally {
        if (!cancelled) {
          setLoadingKey((cur) => (cur === key ? null : cur));
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, recapUuid, recapKind, recapFileCount, recapHeroImage, recapName]);

  if (!recap) return { photos: [], loadingPhotos: false };

  const cached = photoCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return { photos: cached, loadingPhotos: false };
  }
  if (fetched && fetched.key === cacheKey && fetched.items.length > 0) {
    return { photos: fetched.items, loadingPhotos: false };
  }

  const fallback: QuickPeekPhoto[] = recap.heroImage
    ? [
        {
          url: recap.heroImage,
          thumb: thumbUrl(recap.heroImage, 400) || recap.heroImage,
          label: recap.name,
          category: "",
        },
      ]
    : [];

  return {
    photos: fallback,
    loadingPhotos: loadingKey === cacheKey,
  };
}
