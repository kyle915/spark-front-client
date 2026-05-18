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

const IMAGE_RE = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const HEIC_RE = /\.(heic|heif)(\?|$)/i;
const PDF_RE = /\.pdf(\?|$)/i;

export type RecapFileKind = "image" | "heic" | "pdf" | "video" | "other";

export const recapFileKind = (path: string | null | undefined): RecapFileKind => {
  if (!path) return "other";
  if (IMAGE_RE.test(path)) return "image";
  if (HEIC_RE.test(path)) return "heic";
  if (PDF_RE.test(path)) return "pdf";
  if (/\.(mp4|mov|webm)$/i.test(path)) return "video";
  return "other";
};

export const recapFileUrl = (path: string | null | undefined): string => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Strip leading slash so prepend doesn't double up.
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${getBase()}${trimmed}`;
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
  "v2";
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
