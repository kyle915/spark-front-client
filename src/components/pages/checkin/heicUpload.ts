/**
 * iPhone camera-roll photos often arrive as HEIC/HEIF. Safari cannot
 * decode those in `new Image()` + canvas, so a compress-then-upload
 * path spends seconds failing per shot and then uploads the original
 * anyway. Skip canvas for HEIC and let the API convert after submit.
 */
export function isHeicUpload(file: { name?: string; type?: string }): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}
