/**
 * Deterministic upload progress for walk-up photos.
 *
 * Photo PUTs go through `fetch` to a signed URL, which exposes no upload
 * progress events. Rather than fake an animated percentage, progress is
 * derived only from work that has actually finished: a photo counts (in
 * count and in bytes) the moment its PUT resolves. The percentage therefore
 * only ever moves forward as real uploads land.
 */

export type UploadProgressPhoto = {
  state: "uploading" | "done" | "failed";
  file: { size: number };
};

export type UploadProgress = {
  totalCount: number;
  doneCount: number;
  uploadingCount: number;
  totalBytes: number;
  doneBytes: number;
  /** 0–100, from completed bytes (falls back to completed count). */
  percent: number;
};

export function computeUploadProgress(
  photos: readonly UploadProgressPhoto[],
): UploadProgress {
  let doneCount = 0;
  let uploadingCount = 0;
  let totalBytes = 0;
  let doneBytes = 0;
  for (const photo of photos) {
    const size = Number.isFinite(photo.file.size) && photo.file.size > 0 ? photo.file.size : 0;
    totalBytes += size;
    if (photo.state === "done") {
      doneCount++;
      doneBytes += size;
    } else if (photo.state === "uploading") {
      uploadingCount++;
    }
  }
  const percent =
    totalBytes > 0
      ? Math.floor((doneBytes / totalBytes) * 100)
      : photos.length > 0
        ? Math.floor((doneCount / photos.length) * 100)
        : 0;
  return {
    totalCount: photos.length,
    doneCount,
    uploadingCount,
    totalBytes,
    doneBytes,
    percent: Math.min(100, Math.max(0, percent)),
  };
}

export function formatUploadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** "Uploading photos… 2 of 5 done · 43% (1.2 MB of 2.8 MB)" */
export function formatUploadProgress(progress: UploadProgress): string {
  const base = `Uploading photos… ${progress.doneCount} of ${progress.totalCount} done · ${progress.percent}%`;
  if (progress.totalBytes <= 0) return base;
  return `${base} (${formatUploadBytes(progress.doneBytes)} of ${formatUploadBytes(progress.totalBytes)})`;
}
