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

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  // iPhone .mov is often H.264 in a QuickTime container. Chrome attempts
  // playback when the response (and the <source type>) say video/mp4.
  mov: "video/mp4",
  webm: "video/webm",
};

const videoExtension = (path: string): string => {
  const clean = path.split("?")[0]?.split("#")[0] ?? "";
  return clean.split(".").pop()?.toLowerCase() ?? "";
};

/** MIME Chrome should attempt for a recap clip. .mov maps to video/mp4. */
export const recapVideoMime = (path: string | null | undefined): string => {
  if (!path) return "video/mp4";
  return VIDEO_MIME[videoExtension(path)] || "video/mp4";
};

/**
 * Types the check-in upload-url endpoint already signs. Anything else
 * comes back 400 ("Only photo and video uploads are allowed") and the
 * walk-up tile goes FAILED. Keep this list in sync with
 * `_ALLOWED_UPLOAD_TYPES` — do not send a type the live API will reject.
 */
const CHECKIN_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/mpeg",
]);

const UPLOAD_TYPE_ALIAS: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/heic-sequence": "image/heic",
  "image/heif-sequence": "image/heif",
  "video/quicktime": "video/mp4",
  "video/x-m4v": "video/mp4",
  "video/3gpp": "video/mp4",
  "video/3gpp2": "video/mp4",
};

const UPLOAD_EXT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  heics: "image/heic",
  heifs: "image/heif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/mp4",
  webm: "video/webm",
  "3gp": "video/mp4",
};

function uploadExtension(name: string): string {
  const clean = name.split("?")[0]?.split("#")[0] ?? "";
  const dot = clean.lastIndexOf(".");
  if (dot < 0 || dot === clean.length - 1) return "";
  return clean.slice(dot + 1).toLowerCase();
}

/**
 * Content-Type to send on upload. Must be exactly what the signed PUT
 * will require.
 *
 * QuickTime `.mov` is stored as video/mp4 so Chrome can play H.264 clips.
 * Android gallery picks often arrive as `application/octet-stream` (or
 * `image/heic-sequence`) even when the bytes are a photo — sending that
 * raw type makes upload-url 400 and the tile shows FAILED.
 */
export const browserPlayableContentType = (file: {
  type?: string;
  name?: string;
}): string => {
  const raw = (file.type || "").split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = uploadExtension(file.name || "");
  if (
    raw === "video/quicktime" ||
    raw === "video/x-m4v" ||
    extension === "mov" ||
    extension === "m4v"
  ) {
    return "video/mp4";
  }
  const aliased = UPLOAD_TYPE_ALIAS[raw] || raw;
  if (
    aliased &&
    aliased !== "application/octet-stream" &&
    aliased !== "binary/octet-stream" &&
    CHECKIN_UPLOAD_TYPES.has(aliased)
  ) {
    return aliased === "image/jpg" ? "image/jpeg" : aliased;
  }
  const fromName = UPLOAD_EXT_TYPE[extension];
  if (fromName && CHECKIN_UPLOAD_TYPES.has(fromName)) return fromName;
  if (raw.startsWith("video/")) return "video/mp4";
  return "image/jpeg";
};

export const recapFileUrl = (path: string | null | undefined): string => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Strip leading slash so prepend doesn't double up.
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${getBase()}${trimmed}`;
};

/** Blob path inside the recap bucket, from a relative key or a public GCS URL. */
export const recapMediaBlob = (path: string | null | undefined): string => {
  const url = recapFileUrl(path);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    return url.replace(/^\//, "").split("?")[0]?.split("#")[0] ?? "";
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (
      host !== "storage.googleapis.com" &&
      !host.endsWith(".storage.googleapis.com")
    ) {
      return "";
    }
    const parts = parsed.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return "";
    return decodeURIComponent(parts.slice(1).join("/"));
  } catch {
    return "";
  }
};

const graphqlOrigin = (): string => {
  const graphql = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_GRAPHQL_ENDPOINT;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
};

/**
 * URL for an in-page <video> element. Hits the API play endpoint, which
 * 302s to a signed GCS URL with Content-Disposition: inline and a MIME
 * Chrome will attempt. Falls back to the public object URL when the API
 * origin is unknown.
 */
export const recapVideoPlayUrl = (
  path: string | null | undefined,
  origin?: string,
): string => {
  const fileUrl = recapFileUrl(path);
  if (!fileUrl) return "";
  const base = (origin ?? graphqlOrigin()).replace(/\/$/, "");
  const blob = recapMediaBlob(path);
  if (!base || !blob) return fileUrl;
  return `${base}/api/public/media/play?path=${encodeURIComponent(blob)}`;
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
