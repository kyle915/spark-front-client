import { useRef, type ChangeEvent, type CSSProperties, type RefObject } from "react";
import { PHOTO_CAP } from "./photoCap";
import { bucketCountHint } from "./photoBuckets";
import { label, photoBadge, photoRemove } from "./checkinStyles";
import type { Photo, PhotoBucket } from "./checkinTypes";

// Photo step components extracted from SparkCheckin.tsx in the step split —
// same behaviour, no changes.

/**
 * One labelled dropzone. Its own hidden input and its own slice of `photos`,
 * so a bucket never shows — or removes — another bucket's shots.
 *
 * The count is live and advisory. A BA who's short on consumer shots can see it
 * at a glance ("3 of 8 suggested"), but nothing here blocks Submit: failed
 * uploads already don't, and a soft target must not be stricter than a failed
 * upload. What the chip says, and why it must not look like a validation
 * error, is `bucketCountHint`.
 */
export function CorpoCardYesNo({
  value,
  accent,
  onChange,
}: {
  value: boolean | null;
  accent: string;
  onChange: (next: boolean) => void;
}) {
  const choice = (yes: boolean) => {
    const selected = value === yes;
    return {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      border: selected ? `2px solid ${accent}` : "1px solid #d6d3c8",
      background: selected ? accent : "#fff",
      color: selected ? "#111" : "#1c1917",
      fontWeight: 600,
      fontSize: 15,
    } as const;
  };
  return (
    <div data-completeness-target="corpo-card">
      <label style={label}>
        Corporate Card Used <span style={{ color: "#EF5A2A" }}>*</span>
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" style={choice(true)} onClick={() => onChange(true)}>
          Yes
        </button>
        <button type="button" style={choice(false)} onClick={() => onChange(false)}>
          No
        </button>
      </div>
    </div>
  );
}

export function PhotoBucketZone({
  bucket,
  photos,
  onAdd,
  onRemove,
  onKeep,
  accent,
}: {
  bucket: PhotoBucket;
  photos: Photo[];
  onAdd: (files: FileList | null, category: string | null) => void;
  onRemove: (id: string) => void;
  onKeep?: (id: string) => void;
  accent: string;
}) {
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  // Count what actually landed, not what was picked — a photo still uploading
  // or failed isn't in the client's report yet, so counting it would tell a BA
  // they're done when they aren't.
  const done = photos.filter((p) => p.state === "done").length;
  const hint = bucketCountHint(done, bucket.min);

  return (
    <div data-completeness-target={`bucket:${bucket.id}`}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <label style={{ ...label, marginBottom: 0, flex: 1 }}>{bucket.name}</label>
        {hint ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              // Keep "0 of 8 suggested" on one line; the label beside it is
              // flex:1 and wraps instead.
              whiteSpace: "nowrap",
              // Muted until the target is reached, green once it is. NEVER the
              // #EF5A2A this page uses for a required field — see
              // `bucketCountHint`.
              ...(hint.met ? { color: "#2E7D32" } : { opacity: 0.5 }),
            }}
          >
            {hint.text}
          </span>
        ) : null}
      </div>
      {bucket.helper ? (
        <p style={{ fontSize: 12, opacity: 0.6, margin: "2px 0 0" }}>{bucket.helper}</p>
      ) : null}
      <PhotoGrid
        photos={photos}
        onAdd={() => libraryRef.current?.click()}
        onTake={() => cameraRef.current?.click()}
        onRemove={onRemove}
        onKeep={onKeep}
        onRetake={(id) => {
          onRemove(id);
          cameraRef.current?.click();
        }}
        accent={accent}
        allowVideo={Boolean(bucket.accept?.includes("video"))}
      />
      <PhotoFileInputs
        libraryRef={libraryRef}
        cameraRef={cameraRef}
        onFiles={(files) => onAdd(files, bucket.id)}
        accept={bucket.accept || "image/*"}
      />
    </div>
  );
}

/**
 * Library picker first, camera second.
 *
 * `capture="environment"` on the ONLY file input opens the camera on iOS and
 * blocks Camera Roll multi-select — the "Take photo" tile Kyle screenshotted
 * on Consumer Sampling Pictures. The library input has no capture attribute
 * and is `multiple`, so iOS offers Photo Library / Files and a BA can pick
 * the table, product, receipts, and crowd shots in one go. HEIC stays on
 * `accept="image/*"` (listing MIME types falls back to the Files app). Buckets
 * that opt into video pass `accept="image/*,video/*"` so library + camera
 * can add both.
 */
export function PhotoFileInputs({
  libraryRef,
  cameraRef,
  onFiles,
  accept = "image/*",
}: {
  libraryRef: RefObject<HTMLInputElement | null>;
  cameraRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
  accept?: string;
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files);
    e.target.value = "";
  };
  return (
    <>
      <input
        ref={libraryRef}
        type="file"
        accept={accept}
        multiple
        style={{ display: "none" }}
        onChange={handle}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        style={{ display: "none" }}
        onChange={handle}
      />
    </>
  );
}

export function PhotoGrid({
  photos,
  onAdd,
  onTake,
  onRemove,
  onKeep,
  onRetake,
  accent,
  allowVideo = false,
}: {
  photos: Photo[];
  onAdd: () => void;
  onTake: () => void;
  onRemove: (id: string) => void;
  onKeep?: (id: string) => void;
  onRetake?: (id: string) => void;
  accent: string;
  allowVideo?: boolean;
}) {
  const tile: CSSProperties = {
    minWidth: 120,
    minHeight: 120,
    borderRadius: 16,
    background: "transparent",
    fontWeight: 700,
    cursor: "pointer",
    padding: "16px 12px",
  };
  const done = photos.filter((p) => p.state === "done").length;
  const atCap = photos.length >= PHOTO_CAP;
  const mediaWord = allowVideo ? "photos/videos" : "photos";

  return (
    <div>
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          opacity: 0.55,
          margin: "0 0 6px",
        }}
      >
        {done}/{PHOTO_CAP}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {photos.map((p) => {
          const isVideo = p.file.type.startsWith("video/");
          return (
          <div key={p.id} style={{ width: 120 }}>
          <div style={{ position: "relative", width: 120, height: 120 }}>
            {isVideo ? (
              <video
                src={p.previewUrl}
                muted
                playsInline
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 10,
                  opacity: p.state === "done" ? 1 : 0.5,
                  border: p.state === "failed" ? "2px solid #EF5A2A" : "1px solid rgba(0,0,0,0.1)",
                  background: "#111",
                }}
              />
            ) : p.previewUrl ? (
              <img
                src={p.previewUrl}
                alt=""
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 10,
                  opacity: p.state === "done" ? 1 : 0.5,
                  border: p.state === "failed" ? "2px solid #EF5A2A" : "1px solid rgba(0,0,0,0.1)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 10,
                  background: "#e7e5e4",
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              />
            )}
            <span
              style={{
                ...photoBadge,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background:
                  p.state === "failed"
                    ? "rgba(239,90,42,0.72)"
                    : p.state === "uploading"
                      ? "rgba(20,24,26,0.55)"
                      : "rgba(46,125,50,0.55)",
                color: "#fff",
              }}
            >
              {p.state === "done" && isVideo ? "video" : p.state}
            </span>
            <button onClick={() => onRemove(p.id)} style={photoRemove} aria-label="Remove photo">
              ×
            </button>
          </div>
          {p.check && !p.check.dismissed && p.check.message ? (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 12, margin: 0, lineHeight: 1.35 }}>{p.check.message}</p>
              {p.check.kind === "warn" || p.check.kind === "unavailable" ? (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {p.check.kind === "warn" && onRetake ? (
                    <button type="button" onClick={() => onRetake(p.id)} style={{ fontSize: 12, fontWeight: 700 }}>
                      Retake
                    </button>
                  ) : null}
                  {onKeep ? (
                    <button type="button" onClick={() => onKeep(p.id)} style={{ fontSize: 12, fontWeight: 700 }}>
                      Keep
                    </button>
                  ) : null}
                </div>
              ) : onKeep ? (
                <button type="button" onClick={() => onKeep(p.id)} style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>
                  Keep
                </button>
              ) : null}
            </div>
          ) : null}
          </div>
          );
        })}
        {!atCap ? (
          <>
            <button
              type="button"
              onClick={onAdd}
              style={{
                ...tile,
                border: `2px dashed ${accent}`,
                fontSize: 15,
                color: accent,
              }}
            >
              {allowVideo ? "Upload media" : "Upload photos"}
            </button>
            <button
              type="button"
              onClick={onTake}
              style={{
                ...tile,
                border: "2px dashed rgba(0,0,0,0.22)",
                fontSize: 13,
                color: "inherit",
                opacity: 0.75,
              }}
            >
              {allowVideo ? "Take photo/video" : "Take photo"}
            </button>
          </>
        ) : null}
      </div>
      <p style={{ fontSize: 12, opacity: 0.55, margin: "6px 0 0" }}>
        {atCap
          ? `Limit ${PHOTO_CAP} ${mediaWord}. Remove one to add another.`
          : allowVideo
            ? "You can select many photos or videos from your library."
            : "You can select many from your library. iPhone photos are fine."}
      </p>
    </div>
  );
}

