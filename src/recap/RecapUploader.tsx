import { useRef, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { UploadUrlQuery } from "@/api/queries/UploadUrlQuery";
import type { UploadUrlQuery as UploadUrlQueryType } from "@/api/queries/__generated__/UploadUrlQuery.graphql";
import { useAlertStore } from "@/store/alertStore";
import { prepareImageForUpload } from "@/utils/compressImageForUpload";

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
  // Optional override for the button text. Without it the label is derived
  // from `category` ("Upload photos" / "Upload receipt"). Callers that
  // reuse this control for an arbitrary image field (e.g. "Table setup
  // pictures") pass a field-appropriate label so it doesn't read
  // "Upload receipt" on every image field.
  label?: string;
};

type FileState = "uploading" | "done" | "failed";
type FileRow = {
  id: string;
  name: string;
  state: FileState;
};

const PHOTO_CAP = 20;

// NOTE: keep photo accept as the broad `image/*`. iOS Safari falls back
// to the Files-app picker (no multi-select) when accept lists specific
// MIME types like image/heic; image/* keeps the native camera-roll
// picker, which supports multi-select. HEIC → JPEG + downscale runs
// client-side before PUT so BAs on LTE upload smaller blobs.
const ACCEPT: Record<NonNullable<Props["category"]>, string> = {
  photo: "image/*",
  receipt: "image/*,application/pdf",
};

export const RecapUploader: React.FC<Props> = ({
  recapUuid,
  category = "photo",
  onUploaded,
  label: labelOverride,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const safeFilename = (raw: string) =>
    raw
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);

  const setRow = (id: string, state: FileState) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, state } : r)));

  // Takes a plain File[] (NOT a live FileList). The caller snapshots
  // the FileList into an array before clearing the <input>, because
  // an <input type=file> FileList is LIVE — setting input.value=""
  // empties it. Since this loop awaits between files, a live FileList
  // would shrink to length 0 the moment the input was cleared, so
  // only file[0] uploaded and the final count read "0 files". That
  // was the "select several → only one uploads → 0 files" bug.
  const upload = async (files: File[]) => {
    const batch = files.slice(0, PHOTO_CAP).map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      name: file.name,
      state: "uploading" as const,
      file,
    }));
    setBusy(true);
    setRows(batch.map(({ id, name, state }) => ({ id, name, state })));
    let done = 0;
    let failed = 0;
    for (const item of batch) {
      // Photos + image receipts: HEIC→JPEG + downscale. PDFs pass through.
      const prepared = await prepareImageForUpload(item.file);
      const contentType = prepared.type || "application/octet-stream";
      const stamp = Date.now();
      const prefix = category === "receipt" ? "recaps/receipts" : "recaps";
      const path = `${prefix}/${recapUuid}/${stamp}-${safeFilename(prepared.name)}`;
      try {
        const data = await fetchQuery<UploadUrlQueryType>(
          environment,
          UploadUrlQuery,
          { filePath: path, contentType },
        ).toPromise();
        const url = data?.getUploadUrl?.uploadUrl;
        const blobName = data?.getUploadUrl?.blobName ?? path;
        if (!url) throw new Error("No signed URL returned");
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: prepared,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        onUploaded(blobName, category);
        setRow(item.id, "done");
        done += 1;
      } catch {
        setRow(item.id, "failed");
        failed += 1;
      }
    }
    setBusy(false);
    if (done > 0) {
      showAlert(
        `Added ${done} file${done === 1 ? "" : "s"}.`,
        "success",
      );
    }
    if (failed > 0) {
      showAlert(
        `Failed ${failed} file${failed === 1 ? "" : "s"}.`,
        "error",
      );
    }
  };

  const takeFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    upload(picked);
  };

  const label =
    labelOverride ??
    (category === "receipt" ? "Drop receipt" : "Drop photos");
  const doneCount = rows.filter((r) => r.state === "done").length;
  const totalCount = rows.length;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple={category === "photo"}
        accept={ACCEPT[category]}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
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
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          takeFiles(e.dataTransfer.files);
        }}
        className="w-full rounded-xl px-4 py-5 text-sm font-semibold transition active:scale-[0.99]"
        style={{
          background: dragOver ? "rgba(197,245,70,0.10)" : "transparent",
          color: "var(--spark-text)",
          border: `2px dashed ${
            dragOver ? "var(--spark-lime)" : "var(--spark-border)"
          }`,
          opacity: busy ? 0.7 : 1,
        }}
      >
        <span className="block">{busy ? "Uploading…" : label}</span>
        <span
          className="mono text-[10px] mt-1 block"
          style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
        >
          {totalCount > 0 ? `${doneCount}/${totalCount}` : `0/${PHOTO_CAP}`}
        </span>
      </button>
      {rows.length > 0 && (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 text-xs"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              <span className="truncate">{row.name}</span>
              <span
                className="mono shrink-0"
                style={{
                  letterSpacing: "0.12em",
                  color:
                    row.state === "done"
                      ? "var(--spark-lime)"
                      : row.state === "failed"
                        ? "var(--spark-orange, #ef5a2a)"
                        : "rgba(255,255,255,0.45)",
                }}
              >
                {row.state}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RecapUploader;
