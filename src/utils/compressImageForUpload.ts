import { isHeicUpload } from "@/components/pages/checkin/heicUpload";

/** Admin/recap uploads — keep detail for gallery + PDF. */
const DEFAULT_MAX_EDGE = 2048;
const DEFAULT_JPEG_QUALITY = 0.85;
const DEFAULT_MIN_BYTES = 200 * 1024;

/**
 * Walk-up / check-in field photos on store LTE. More aggressive than
 * admin recap so ~100 iPhone shots finish before the BA clocks out.
 */
export const FIELD_PHOTO_PREP = {
  maxEdge: 1600,
  quality: 0.82,
  minBytes: 400 * 1024,
} as const;

export type PrepareImageOptions = {
  maxEdge?: number;
  quality?: number;
  minBytes?: number;
};

async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg" });
  const blob = Array.isArray(out) ? out[0] : out;
  if (!blob) throw new Error("HEIC conversion produced no frames");
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

async function downscaleImage(
  file: File,
  opts: Required<PrepareImageOptions>,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < opts.minBytes) {
    return file;
  }

  let url: string | null = null;
  try {
    url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url as string;
    });

    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (!longest) return file;
    const scale = Math.min(1, opts.maxEdge / longest);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", opts.quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/**
 * Prepare a photo for GCS upload: HEIC/HEIF → JPEG, then downscale.
 * Best-effort — returns the original file on any failure so a flaky
 * decoder never blocks the BA from filing the shot.
 */
export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {},
): Promise<File> {
  if (file.type === "application/pdf") return file;

  const opts: Required<PrepareImageOptions> = {
    maxEdge: options.maxEdge ?? DEFAULT_MAX_EDGE,
    quality: options.quality ?? DEFAULT_JPEG_QUALITY,
    minBytes: options.minBytes ?? DEFAULT_MIN_BYTES,
  };

  let prepared = file;
  if (isHeicUpload(file)) {
    try {
      prepared = await convertHeicToJpeg(file);
    } catch {
      return file;
    }
  }

  try {
    return await downscaleImage(prepared, opts);
  } catch {
    return prepared;
  }
}
