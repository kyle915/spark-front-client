/**
 * Check-in / walk-up modules.
 *
 * SparkCheckin.tsx remains the page shell; helpers live beside it so field
 * fixes (upload stall, proximity, drafts) do not require editing a 4.5k file.
 */
export { default as SparkCheckin } from "./SparkCheckin";
export {
  UPLOAD_STALL_MS,
  stalledUploadingCount,
  uploadStallMessage,
} from "./uploadStall";
export {
  computeUploadProgress,
  formatUploadProgress,
} from "./uploadProgress";
