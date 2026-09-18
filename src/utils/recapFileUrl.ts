/**
 * Spark v2 — recap file URL helper.
 *
 * recaps_recapfile.file stores relative paths like
 *   recaps/1778787257191-recap-1778787257191-1.heic
 * pointing at the GCS bucket that holds the production photos. We
 * prepend the bucket URL so <img src> can actually load them.
 *
 * Override via VITE_RECAP_FILE_BASE in .env.local if the bucket changes.
 * Default points at the existing sparkio-production bucket since the
 * cloned DB references those exact keys.
 */

const DEFAULT_BASE = "https://storage.googleapis.com/sparkio-production/";

const getBase = (): string => {
  const fromEnv = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_RECAP_FILE_BASE;
  const base = fromEnv || DEFAULT_BASE;
  return base.endsWith("/") ? base : `${base}/`;
};

const IMAGE_RE = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;
const HEIC_RE = /\.(heic|heif)(\?|#|$)/i;
const PDF_RE = /\.pdf(\?|#|$)/i;
const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;

export type RecapFileKind = "image" | "heic" | "pdf" | "video" | "other";

export const recapFileKind = (path: string | null | undefined): RecapFileKind => {
  if (!path) return "other";
  if (IMAGE_RE.test(path)) return "image";
  if (HEIC_RE.test(path)) return "heic";
  if (PDF_RE.test(path)) return "pdf";
  if (VIDEO_RE.test(path)) return "video";
  return "other";
};

/**
 * How a custom-recap evidence file should render in a gallery.
 *
 * Walk-up uploads stamp every file as FileType "image" (the first row),
 * including Kalshi Activation Photos videos. Category names like
 * "Activation Photos" also look image-like. The stored path wins: a
 * .mov/.mp4 must not go in <img>, or the card shows the broken-image
 * icon plus the alt text.
 */
export function recapGallerySlot(file: {
  url?: string | null;
  displayUrl?: string | null;
  fileTypeName?: string | null;
  categoryName?: string | null;
}): "image" | "video" | "pdf" | "file" {
  const paths = [file.url, file.displayUrl];
  if (paths.some((path) => recapFileKind(path) === "video")) return "video";
  if (paths.some((path) => recapFileKind(path) === "pdf")) return "pdf";
  const typeName = (file.fileTypeName ?? "").toLowerCase();
  if (typeName === "pdf") return "pdf";
  const url = (file.displayUrl || file.url || "").toLowerCase();
  if (
    typeName === "image" ||
    typeName === "img" ||
    typeName === "photo" ||
    recapFileKind(url) === "image" ||
    recapFileKind(url) === "heic"
  ) {
    return "image";
  }
  const category = (file.categoryName ?? "").toLowerCase();
  if (
    Boolean(url) &&
    (category.includes("photo") ||
      category.includes("sampling") ||
      category.includes("picture") ||
      category.includes("table"))
  ) {
    return "image";
  }
  return "file";
}

export const recapFileUrl = (path: string | null | undefined): string => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Strip leading slash so prepend doesn't double up.
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${getBase()}${trimmed}`;
};

/**
 * Browser-renderable recap image URL. HEIC/HEIF rewrites to the server
 * `.jpg` sibling the same way GraphQL `displayUrl` does, so <img> and
 * thumbUrl(400) can load iPhone sampling shots instead of grey boxes.
 */
export const recapDisplayUrl = (path: string | null | undefined): string => {
  const url = recapFileUrl(path);
  if (!url) return "";
  return url.replace(/\.hei[cf](?=(\?|#|$))/i, ".jpg");
};

/**
 * Same as recapFileUrl but appends a one-time cache-buster query string.
 * Use sparingly — only when you've changed bucket permissions and need
 * to force the browser to re-fetch URLs that previously 403'd.
 *
 * The build version is baked at compile time; each new deploy invalidates
 * cached failures without thrashing on every render.
 */
const CACHE_BUST =
  (import.meta as { env?: Record<string, string> }).env?.VITE_RECAP_CACHE_BUST ??
  "v6";
export const recapFileUrlFresh = (path: string | null | undefined): string => {
  const url = recapFileUrl(path);
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}cb=${CACHE_BUST}`;
};

/**
 * Pick the best hero image candidate from a list of recap files.
 * Order of preference:
 *   1. .jpg/.png/.webp/.gif — browsers can render directly
 *   2. nothing else (HEIC + PDF aren't valid <img src> values without
 *      a conversion step)
 */
export const pickHeroImage = (
  files: ReadonlyArray<{ file?: string | null } | null | undefined>,
): string | null => {
  for (const f of files) {
    if (!f?.file) continue;
    if (recapFileKind(f.file) === "image") return recapFileUrlFresh(f.file);
  }
  return null;
};
