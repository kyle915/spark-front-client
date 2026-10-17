/**
 * Cheap, conservative photo checks at capture time.
 *
 * A BA is still standing in the store when these run, so a "this looks
 * black / smeared / identical to the last one" nudge can be fixed with a
 * retake. Nothing here rejects an upload: thresholds only flag obvious
 * cases, the photo keeps uploading, and the BA picks Retake or Keep.
 * Analysis runs on a tiny downscale, never the full-resolution file.
 */

export type PhotoQualityKind = "dark" | "blurry" | "duplicate";

export type PhotoQualityWarning = {
  photoId: string;
  kind: PhotoQualityKind;
  message: string;
};

export const DARK_MEAN_MAX = 16;
export const BLURRY_LAPLACIAN_MIN = 6;

export function grayFromRgba(rgba: Uint8ClampedArray | number[]): number[] {
  const gray: number[] = [];
  for (let i = 0; i + 3 < rgba.length + 1 && i < rgba.length; i += 4) {
    gray.push(0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]);
  }
  return gray;
}

export function meanLuminance(gray: readonly number[]): number {
  if (!gray.length) return 0;
  return gray.reduce((a, b) => a + b, 0) / gray.length;
}

/** Variance of a 4-neighbour Laplacian — low means little edge detail. */
export function laplacianVariance(gray: readonly number[], width: number): number {
  if (width < 3 || gray.length < width * 3) return Number.POSITIVE_INFINITY;
  const height = Math.floor(gray.length / width);
  const values: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      values.push(gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i]);
    }
  }
  if (!values.length) return Number.POSITIVE_INFINITY;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
}

export function classifyPhotoQuality(stats: {
  mean: number;
  blur: number;
}): Exclude<PhotoQualityKind, "duplicate"> | null {
  if (stats.mean < DARK_MEAN_MAX) return "dark";
  if (stats.blur < BLURRY_LAPLACIAN_MIN) return "blurry";
  return null;
}

export function qualityMessage(kind: PhotoQualityKind): string {
  switch (kind) {
    case "dark":
      return "This photo looks very dark — the client may not be able to see it.";
    case "blurry":
      return "This photo looks blurry — hold steady and tap to focus if you retake it.";
    case "duplicate":
      return "This looks like an exact copy of another photo in this recap.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Small FNV-1a hash over size + head/middle/tail slices. Exact copies match. */
export async function quickPhotoHash(file: File): Promise<string> {
  const size = file.size;
  const slices: Blob[] = [];
  const chunk = 8192;
  if (size > 0) {
    slices.push(file.slice(0, chunk));
    if (size > chunk * 2) slices.push(file.slice(Math.floor(size / 2), Math.floor(size / 2) + chunk));
    if (size > chunk) slices.push(file.slice(size - chunk, size));
  }
  let hash = 2166136261;
  for (const slice of slices) {
    const bytes = new Uint8Array(await slice.arrayBuffer());
    for (const b of bytes) {
      hash ^= b;
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${size}:${(hash >>> 0).toString(16)}`;
}

const ANALYSIS_SIZE = 48;

/** Downscaled luminance/blur stats, or null when the image can't be read. */
export async function analyzePhotoFile(
  file: File,
): Promise<{ mean: number; blur: number } | null> {
  if (!file.type.startsWith("image/") || file.size === 0) return null;
  if (typeof document === "undefined" || typeof URL === "undefined") return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = ANALYSIS_SIZE;
    canvas.height = ANALYSIS_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    const data = ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE).data;
    const gray = grayFromRgba(data);
    return { mean: meanLuminance(gray), blur: laplacianVariance(gray, ANALYSIS_SIZE) };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
