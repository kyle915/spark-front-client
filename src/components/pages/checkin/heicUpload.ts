/**
 * iPhone camera-roll photos often arrive as HEIC/HEIF. Safari cannot
 * decode those in `new Image()` + canvas, so upload prep converts via
 * heic2any (WASM) to JPEG first, then downscales — see
 * prepareImageForUpload.
 */
export function isHeicUpload(file: { name?: string; type?: string }): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}
