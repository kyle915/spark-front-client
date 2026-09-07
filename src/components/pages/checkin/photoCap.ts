/**
 * Hard ceiling on photos a BA (or admin) can attach to one recap upload
 * surface. Walk-up check-in and RecapUploader both honor this so the
 * counter chip stays honest (was 20 → 50; Feel Free field days need ~100).
 */
export const PHOTO_CAP = 100;
