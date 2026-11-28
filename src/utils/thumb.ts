/**
 * Recap photo thumbnails — direct GCS thumbnail URLs (`thumbs/w{w}/{blob}.jpg`)
 * with seamless fallback to the on-demand resize endpoint
 * (spark-api `/api/public/img/thumb`) and then the full-res original.
 *
 * Pre-generated thumbs on GCS load in 1 HTTP hop from Google CDN/GCS with zero
 * Cloud Run round-trip; if an older historic photo has not been materialized
 * yet, `thumbSources` / `handleThumbError` falls back to `/api/public/img/thumb`
 * (which materializes the thumb in GCS for all future viewers) and then to the
 * original URL.
 */

const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
  }
})();

export type ThumbWidth = 400 | 800;

const GCS_PUBLIC_URL_RE =
  /^https:\/\/storage\.googleapis\.com\/([^/?#]+)\/([^?#]+)(?:[?#].*)?$/;

/**
 * Private-media URL from the API (`/api/public/media/o/<token>/<name>`).
 * The API serves these for recap photos, receipts, documents etc. once the
 * bucket is private; the same endpoint takes `?w=` and serves a thumbnail.
 */
export const isPrivateMediaUrl = (url: string | null | undefined): boolean =>
  !!url && url.includes("/api/public/media/o/");

export function thumbUrl(
  url: string | null | undefined,
  w: ThumbWidth = 400,
): string {
  if (!url) return "";
  if (isPrivateMediaUrl(url)) {
    // Token URLs thumb themselves. Drop any client cache-buster first.
    const base = url.split("?")[0];
    return `${base}?w=${w}`;
  }
  // Only our own GCS objects can be thumbed; anything else (data URIs,
  // already-thumbed URLs, foreign hosts) passes through untouched.
  if (!API_ORIGIN || !url.includes("storage.googleapis.com/")) return url;
  return `${API_ORIGIN}/api/public/img/thumb?path=${encodeURIComponent(url)}&w=${w}`;
}

/**
 * Direct GCS URL (`https://storage.googleapis.com/<bucket>/thumbs/w<w>/<blob>.jpg`)
 * matching `utils/thumb_views.py:_thumb_blob_name`, skipping the Cloud Run 302
 * redirect hop. Falls back to `thumbUrl(url, w)` for private-media tokens,
 * raw `.heic`/`.heif` paths, PDFs, or non-GCS URLs.
 */
export function directThumbUrl(
  url: string | null | undefined,
  w: ThumbWidth = 400,
): string {
  if (!url) return "";
  if (isPrivateMediaUrl(url)) {
    return thumbUrl(url, w);
  }
  const match = GCS_PUBLIC_URL_RE.exec(url);
  if (!match) {
    return thumbUrl(url, w);
  }
  const [, bucket, blob] = match;
  if (!bucket || !blob) {
    return thumbUrl(url, w);
  }
  if (blob.startsWith("thumbs/")) {
    return url;
  }
  const lower = blob.toLowerCase();
  if (
    lower.endsWith(".heic") ||
    lower.endsWith(".heif") ||
    lower.endsWith(".pdf") ||
    lower.startsWith("recaps/pdfs/")
  ) {
    return thumbUrl(url, w);
  }
  return `https://storage.googleapis.com/${bucket}/thumbs/w${w}/${blob}.jpg`;
}

/**
 * Ordered candidate URLs for `<SparkThumb sources={thumbSources(url, 400)} />`:
 *   1. Direct GCS pre-generated thumb (`thumbs/w{w}/{blob}.jpg`)
 *   2. On-demand API thumb (`/api/public/img/thumb?...`, materializes on miss)
 *   3. Full-resolution original URL
 */
export function thumbSources(
  url: string | null | undefined,
  w: ThumbWidth = 400,
): string[] {
  if (!url) return [];
  const candidates = [directThumbUrl(url, w), thumbUrl(url, w), url];
  const out: string[] = [];
  for (const candidate of candidates) {
    if (candidate && !out.includes(candidate)) {
      out.push(candidate);
    }
  }
  return out;
}

/**
 * Progressive `onError` handler for plain `<img>` elements using `directThumbUrl`:
 *   miss #1 -> retry `thumbUrl(rawUrl, w)` (materializes thumb in GCS)
 *   miss #2 -> retry `rawUrl` (full-res original)
 */
export function handleThumbError(
  img: HTMLImageElement | null,
  rawUrl: string | null | undefined,
  w: ThumbWidth = 400,
): void {
  if (!img || !rawUrl) return;
  const step = img.dataset.sparkThumbStep;
  if (!step) {
    img.dataset.sparkThumbStep = "1";
    const apiThumb = thumbUrl(rawUrl, w);
    if (apiThumb && apiThumb !== img.src) {
      img.src = apiThumb;
      return;
    }
  }
  if (img.dataset.sparkThumbStep !== "2") {
    img.dataset.sparkThumbStep = "2";
    if (rawUrl !== img.src) {
      img.src = rawUrl;
    }
  }
}
