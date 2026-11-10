import { recapDisplayUrl, recapGallerySlot } from "@/utils/recapFileUrl";

/**
 * Pick the photo that represents a recap on client-facing program views
 * (Home "at a glance", the program report gallery).
 *
 * A recap's stored "hero" image is simply its first file, which is often a
 * receipt or product-spend photo. Those must never be shown as a program
 * highlight, so this looks at each file's CATEGORY and returns the first
 * real field photo — preferring sampling / booth / setup shots — or null
 * when the recap only has receipts (the recap is then left out).
 */
export type FieldPhotoFile = {
  url?: string | null;
  displayUrl?: string | null;
  fileType?: { name?: string | null } | null;
  fileRecapCategory?: { name?: string | null } | null;
};

// Money / paperwork buckets: never a program photo.
const NOT_A_FIELD_PHOTO_RE =
  /receipt|product\s*spend|account\s*spend|expense|spend|invoice|mileage|odometer|paperwork|signature/i;

// Buckets that are the story of the activation.
const PREFERRED_RE =
  /sampling|action|consumer|engag|booth|table|set\s*-?up|display|event|photo|activation/i;

export function isFieldPhotoCategory(name: string | null | undefined): boolean {
  return !NOT_A_FIELD_PHOTO_RE.test(name ?? "");
}

export function pickFieldPhoto(
  files: readonly (FieldPhotoFile | null | undefined)[] | null | undefined,
): string | null {
  const images = (files ?? []).filter((f): f is FieldPhotoFile => {
    if (!f) return false;
    const category = f.fileRecapCategory?.name;
    if (!isFieldPhotoCategory(category)) return false;
    return (
      recapGallerySlot({
        url: f.url,
        displayUrl: f.displayUrl,
        fileTypeName: f.fileType?.name,
        categoryName: category,
      }) === "image"
    );
  });
  if (images.length === 0) return null;
  const best =
    images.find((f) => PREFERRED_RE.test(f.fileRecapCategory?.name ?? "")) ??
    images[0];
  const src = recapDisplayUrl(best.displayUrl || best.url || "");
  return src || null;
}
