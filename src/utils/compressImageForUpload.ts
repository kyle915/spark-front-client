import { isHeicUpload } from "@/components/pages/checkin/heicUpload";

/** Long edge cap for recap uploads — balances quality vs LTE upload size. */
const MAX_IMAGE_EDGE = 2048;
const JPEG_QUALITY = 0.85;
/** Below this, re-encoding costs more than it saves. */
const COMPRESS_MIN_BYTES = 200 * 1024;

async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = (await heic2any({ blob: file, toType: "image/jpeg" })) as Blob;
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([out], `${base}.jpg`, { type: "image/jpeg" });
}

async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < COMPRESS_MIN_BYTES) {
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
    const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
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
 * Best-effort — returns the original file on any failure.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;

  let prepared = file;
  if (isHeicUpload(file)) {
    try {
      prepared = await convertHeicToJpeg(file);
    } catch {
      return file;
    }
  }

  try {
    return await downscaleImage(prepared);
  } catch {
    return prepared;
  }
}
