/**
 * iPhone camera-roll photos often arrive as HEIC/HEIF. Safari cannot
 * decode those in `new Image()` + canvas, so upload prep converts via
 * heic2any (WASM) to JPEG first, then downscales — see
 * prepareImageForUpload.
 *
 * Android Chrome is worse: MimeTypeMap misses `.heic` on a lot of phones
 * and the file input reports `application/octet-stream` (or a sequence
 * type). Those still need the HEIC path or the upload-url allowlist
 * rejects them and the tile sits on FAILED with a broken-image icon.
 */
const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
  "heim",
  "heis",
]);

function bareType(type: string | undefined): string {
  return (type || "").split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isHeicUpload(file: { name?: string; type?: string }): boolean {
  if (HEIC_TYPES.has(bareType(file.type))) return true;
  const name = (file.name || "").toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    name.endsWith(".heics") ||
    name.endsWith(".heifs")
  );
}

/** ISO-BMFF `ftyp` brand. Android often hides this behind octet-stream. */
export async function fileLooksLikeHeic(file: Blob): Promise<boolean> {
  if (file.size < 12) return false;
  const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) {
    return false;
  }
  const brand = String.fromCharCode(buf[8] ?? 0, buf[9] ?? 0, buf[10] ?? 0, buf[11] ?? 0);
  return HEIC_BRANDS.has(brand);
}

function genericType(type: string | undefined): boolean {
  const bare = bareType(type);
  return bare === "" || bare === "application/octet-stream" || bare === "binary/octet-stream";
}

/**
 * Give HEIC bytes a name and type the converter and the upload allowlist
 * both understand. No-op for JPEGs. Does not decode — conversion is separate.
 */
export async function coerceHeicFile(file: File): Promise<File> {
  if (!isHeicUpload(file) && genericType(file.type)) {
    if (!(await fileLooksLikeHeic(file))) return file;
  } else if (!isHeicUpload(file)) {
    return file;
  }

  const type = bareType(file.type);
  const heif = type === "image/heif" || type === "image/heif-sequence" || file.name.toLowerCase().endsWith(".heif");
  const nextType = heif ? "image/heif" : "image/heic";
  const ext = heif ? "heif" : "heic";
  const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
  if (file.type === nextType && file.name.toLowerCase().endsWith(`.${ext}`)) return file;
  return new File([file], `${base}.${ext}`, { type: nextType });
}
