import { useRef, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { UploadUrlQuery } from "@/api/queries/UploadUrlQuery";
import type { UploadUrlQuery as UploadUrlQueryType } from "@/api/queries/__generated__/UploadUrlQuery.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — Recap photo / receipt uploader.
 *
 * Picks files, requests signed GCS upload URLs, PUTs each blob direct
 * to the bucket. The actual linking to a recap (creating a RecapFile
 * row in Postgres) requires a backend AddRecapFile mutation — UI calls
 * onUploaded(blobName) so the parent can wire that in when ready.
 */

type Props = {
  recapUuid: string;
  category?: "photo" | "receipt";
  onUploaded: (blobName: string, kind: "photo" | "receipt") => void;
};

// NOTE: keep photo accept as the broad `image/*`. iOS Safari falls back
// to the Files-app picker (no multi-select) when accept lists specific
// MIME types like image/heic; image/* keeps the native camera-roll
// picker, which supports multi-select. Server-side conversion handles
// any weird format that sneaks through (HEIC → JPG runs at upload time).
const ACCEPT: Record<NonNullable<Props["category"]>, string> = {
  photo: "image/*",
  receipt: "image/*,application/pdf",
};

export const RecapUploader: React.FC<Props> = ({
  recapUuid,
  category = "photo",
  onUploaded,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const safeFilename = (raw: string) =>
    raw
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);

  // Takes a plain File[] (NOT a live FileList). The caller snapshots
  // the FileList into an array before clearing the <input>, because
  // an <input type=file> FileList is LIVE — setting input.value=""
  // empties it. Since this loop awaits between files, a live FileList
  // would shrink to length 0 the moment the input was cleared, so
  // only file[0] uploaded and the final count read "0 files". That
  // was the "select several → only one uploads → 0 files" bug.
  const upload = async (files: File[]) => {
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const contentType = file.type || "application/octet-stream";
      const stamp = Date.now();
      const prefix = category === "receipt" ? "recaps/receipts" : "recaps";
      const path = `${prefix}/${recapUuid}/${stamp}-${safeFilename(file.name)}`;
      try {
        const data = await fetchQuery<UploadUrlQueryType>(
          environment,
          UploadUrlQuery,
          { filePath: path, contentType },
        ).toPromise();
        const url = data?.getUploadUrl?.uploadUrl;
        const blobName = data?.getUploadUrl?.blobName ?? path;
        if (!url) throw new Error("No signed URL returned");
        // PUT direct to GCS
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        onUploaded(blobName, category);
      } catch (e) {
        showAlert(
          `Couldn't upload ${file.name}: ${(e as Error).message}`,
          "error",
        );
      } finally {
        setProgress({ done: i + 1, total: files.length });
      }
    }
    setBusy(false);
    setProgress(null);
    showAlert(
      `Added ${files.length} file${files.length === 1 ? "" : "s"}. ` +
        `Tap the button again to add more before submitting.`,
      "success",
    );
  };

  const label =
    category === "receipt" ? "📎 Upload receipt" : "📷 Upload photos";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple={category === "photo"}
        accept={ACCEPT[category]}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            // Snapshot to a stable array BEFORE clearing the input.
            // input.value="" empties the live FileList, and `upload`
            // awaits between files — without the snapshot the list
            // collapses to length 0 mid-loop and only the first photo
            // uploaded. Clearing the input after is still needed so
            // re-picking the same file fires onChange again.
            const picked = Array.from(e.target.files);
            e.target.value = "";
            upload(picked);
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition"
        style={{
          background:
            category === "receipt"
              ? "transparent"
              : "var(--spark-lime)",
          color: category === "receipt" ? "var(--spark-text)" : "#0a0d09",
          border:
            category === "receipt"
              ? "1px solid var(--spark-border)"
              : "none",
          boxShadow:
            category === "receipt"
              ? "none"
              : "0 0 18px rgba(197,245,70,0.35)",
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy && progress
          ? `Uploading ${progress.done}/${progress.total}…`
          : label}
      </button>
    </>
  );
};

export default RecapUploader;
