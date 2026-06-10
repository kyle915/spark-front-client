/**
 * Recap photo thumbnails — rewrite a full-res GCS public URL to the
 * on-demand resize endpoint (spark-api `/api/public/img/thumb`).
 *
 * The endpoint materializes a resized JPEG on first request, caches it
 * in GCS, and 302s; on ANY failure (non-image, missing blob, HEIC the
 * server can't decode) it 302s to the original, so the worst case is
 * exactly the old behavior. Use on LIST/GRID surfaces only — detail
 * views and lightboxes keep the full-res original.
 */

const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
  }
})();

export type ThumbWidth = 400 | 800;

export function thumbUrl(
  url: string | null | undefined,
  w: ThumbWidth = 400,
): string {
  if (!url) return "";
  // Only our own GCS objects can be thumbed; anything else (data URIs,
  // already-thumbed URLs, foreign hosts) passes through untouched.
  if (!API_ORIGIN || !url.includes("storage.googleapis.com/")) return url;
  return `${API_ORIGIN}/api/public/img/thumb?path=${encodeURIComponent(url)}&w=${w}`;
}
