import { useEffect, useRef, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { UploadUrlQuery } from "@/api/queries/UploadUrlQuery";
import type { UploadUrlQuery as UploadUrlQueryType } from "@/api/queries/__generated__/UploadUrlQuery.graphql";
import { useAlertStore } from "@/store/alertStore";
import { prepareImageForUpload } from "@/utils/compressImageForUpload";
import { PHOTO_CAP } from "@/components/pages/checkin/photoCap";

/**
 * Spark v2 — Recap photo / receipt uploader.
 *
 * Library picker first (multiple, no `capture`), camera second. Putting
 * `capture="environment"` on the only file input opens the camera on iOS
 * and blocks Camera Roll multi-select — same trap as walk-up check-in.
 * Accept stays `image/*` so iOS keeps the native multi-select gallery
 * (listing MIME types falls back to the Files app).
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
  previewUrl: string | null;
};

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
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const previewsRef = useRef<string[]>([]);
  const revokePreviews = () => {
    for (const url of previewsRef.current) URL.revokeObjectURL(url);
    previewsRef.current = [];
  };
  useEffect(() => {
    const urls = previewsRef;
    return () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    };
  }, []);

  const safeFilename = (raw: string) =>
    raw
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);

  const setRow = (id: string, patch: Partial<Pick<FileRow, "state" | "previewUrl">>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

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
    revokePreviews();
    setBusy(true);
    setRows(
      batch.map(({ id, name, state }) => ({
        id,
        name,
        state,
        previewUrl: null,
      })),
    );
    let done = 0;
    let failed = 0;
    for (const item of batch) {
      // Photos + image receipts: HEIC→JPEG + downscale. PDFs pass through.
      const prepared = await prepareImageForUpload(item.file);
      if (prepared.type.startsWith("image/")) {
        const previewUrl = URL.createObjectURL(prepared);
        previewsRef.current.push(previewUrl);
        setRow(item.id, { previewUrl });
      }
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
        setRow(item.id, { state: "done" });
        done += 1;
      } catch {
        setRow(item.id, { state: "failed" });
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
    void upload(picked);
  };

  const label =
    labelOverride ??
    (category === "receipt" ? "Upload from library" : "Upload from library");
  const cameraLabel =
    category === "receipt" ? "Take receipt photo" : "Take photo";
  const doneCount = rows.filter((r) => r.state === "done").length;
  const totalCount = rows.length;

  return (
    <div className="space-y-2 min-w-64">
      {/* Library: multiple, no capture — iOS Camera Roll multi-select. */}
      <input
        ref={libraryRef}
        type="file"
        multiple
        accept={ACCEPT[category]}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const picked = Array.from(e.target.files);
            e.target.value = "";
            void upload(picked);
          }
        }}
      />
      {/* Camera: single shot with rear camera. Separate input so library stays gallery. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const picked = Array.from(e.target.files);
            e.target.value = "";
            void upload(picked);
          }
        }}
      />
      <button
        type="button"
        onClick={() => libraryRef.current?.click()}
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
        className={`recap-upload-library w-full rounded-xl px-4 py-5 text-sm font-semibold transition active:scale-[0.99]${
          dragOver ? " is-drag" : ""
        }${doneCount > 0 ? " is-filled" : ""}`}
        style={{ opacity: busy ? 0.7 : 1 }}
      >
        <span className="block">{busy ? "Uploading…" : label}</span>
        <span
          className={`recap-upload-meta mono text-[10px] mt-1 block${
            totalCount > 0 && doneCount === totalCount ? " is-complete" : ""
          }`}
        >
          {totalCount > 0
            ? doneCount === totalCount
              ? `${doneCount} uploaded`
              : `${doneCount}/${totalCount}`
            : `PHOTO LIBRARY · UP TO ${PHOTO_CAP}`}
        </span>
      </button>
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        disabled={busy}
        className="recap-upload-camera w-full rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99]"
        style={{ opacity: busy ? 0.7 : 1 }}
      >
        {cameraLabel}
      </button>
      {rows.length > 0 && (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="recap-upload-row flex items-center justify-between gap-3 text-xs"
              data-state={row.state}
            >
              {row.previewUrl ? (
                <img src={row.previewUrl} alt="" className="recap-upload-thumb" />
              ) : null}
              <span className="truncate flex-1">{row.name}</span>
              <span className="recap-upload-status shrink-0">
                {row.state === "done"
                  ? "✓ Uploaded"
                  : row.state === "failed"
                    ? "Failed"
                    : "Uploading"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RecapUploader;
