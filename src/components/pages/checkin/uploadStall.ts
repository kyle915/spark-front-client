/**
 * Detect LTE / stalled photo uploads for BA-facing copy.
 *
 * A photo left in `uploading` longer than STALL_MS is treated as stalled so
 * the UI can offer Retry / Submit without photos instead of a forever spinner.
 */

export const UPLOAD_STALL_MS = 45_000;

export type StallPhoto = {
  id: string;
  state: "queued" | "uploading" | "done" | "failed";
  startedAt?: number | null;
};

export function stalledUploadingCount(
  photos: readonly StallPhoto[],
  nowMs: number = Date.now(),
  stallMs: number = UPLOAD_STALL_MS,
): number {
  return photos.filter(
    (p) =>
      p.state === "uploading" &&
      typeof p.startedAt === "number" &&
      nowMs - p.startedAt >= stallMs,
  ).length;
}

export function uploadStallMessage(
  stalled: number,
  failed: number,
): string | null {
  if (stalled <= 0 && failed <= 0) return null;
  const parts: string[] = [];
  if (stalled > 0) {
    parts.push(
      `${stalled} photo${stalled === 1 ? "" : "s"} still uploading — check your signal and tap Retry`,
    );
  }
  if (failed > 0) {
    parts.push(
      `${failed} photo${failed === 1 ? "" : "s"} failed — Retry or submit without them`,
    );
  }
  return parts.join(". ");
}
