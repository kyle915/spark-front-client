import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { UploadUrlQuery } from "@/api/queries/UploadUrlQuery";
import type { UploadUrlQuery as UploadUrlQueryType } from "@/api/queries/__generated__/UploadUrlQuery.graphql";
import { prepareImageForUpload } from "@/utils/compressImageForUpload";

/**
 * Shared helpers for chat attachments on the admin web.
 *
 * Uploading reuses the exact recap-photo flow: request a signed GCS
 * upload URL (getUploadUrl), PUT the file straight to the bucket, keep
 * the returned blob path. The blob path is what we hand to
 * sendChatMessage / broadcastChatMessage as ChatAttachmentInput.file —
 * the server serves it back via the non-signed public URL.
 */

export type PendingAttachment = {
  // Local id for list keying / removal before send.
  localId: string;
  blobName: string;
  kind: "image" | "pdf" | "file";
  originalFilename: string;
  contentType: string;
  byteSize: number;
  // Object URL for local preview of images before the message exists.
  previewUrl?: string;
};

// Images keep the broad image/* accept so iOS Safari uses the native
// camera-roll picker (multi-select). PDFs are explicit. Mirrors the
// recap receipt uploader's accept string.
export const CHAT_ATTACHMENT_ACCEPT = "image/*,application/pdf";

export function kindForFile(file: File): "image" | "pdf" | "file" {
  const ct = (file.type || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf") return "pdf";
  const name = (file.name || "").toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/.test(name)) return "image";
  if (name.endsWith(".pdf")) return "pdf";
  return "file";
}

function safeFilename(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

/**
 * Upload a single File to GCS and return a PendingAttachment, or throw.
 * `scope` is a short path segment (e.g. a thread uuid or "broadcast")
 * used to bucket the blob under chat_attachments/.
 */
export async function uploadChatAttachment(
  file: File,
  scope: string,
): Promise<PendingAttachment> {
  const prepared = await prepareImageForUpload(file);
  const contentType = prepared.type || "application/octet-stream";
  const stamp = Date.now();
  const path = `chat_attachments/${scope}/${stamp}-${safeFilename(prepared.name)}`;

  const data = await fetchQuery<UploadUrlQueryType>(environment, UploadUrlQuery, {
    filePath: path,
    contentType,
  }).toPromise();

  const url = data?.getUploadUrl?.uploadUrl;
  const blobName = data?.getUploadUrl?.blobName ?? path;
  if (!url) throw new Error("No signed upload URL returned");

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: prepared,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);

  const kind = kindForFile(prepared);
  return {
    localId: `${stamp}-${Math.random().toString(36).slice(2, 8)}`,
    blobName,
    kind,
    originalFilename: prepared.name,
    contentType,
    byteSize: prepared.size,
    previewUrl: kind === "image" ? URL.createObjectURL(prepared) : undefined,
  };
}

/** Map PendingAttachment[] to the ChatAttachmentInput[] the API takes. */
export function toAttachmentInputs(pending: PendingAttachment[]) {
  return pending.map((a) => ({
    file: a.blobName,
    kind: a.kind,
    originalFilename: a.originalFilename,
    contentType: a.contentType,
    byteSize: a.byteSize,
  }));
}

export function humanSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
