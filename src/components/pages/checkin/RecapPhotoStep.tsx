import { useRef, type ChangeEvent, type CSSProperties, type RefObject } from "react";
import { PHOTO_CAP } from "./photoCap";
import {
  bucketCountHint,
  isExpenseReceiptBucket,
  RECEIPT_PHOTO_TIP,
} from "./photoBuckets";
import { helperText, label, photoRemove } from "./checkinStyles";
import type { Photo, PhotoBucket } from "./checkinTypes";
import { DEFAULT_QUICK_PHOTO_SLOTS, slotActionLabel } from "./oneHandedCheckin";

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
  const slotMet = bucket.min > 0 ? done >= bucket.min : done >= 1;
  const actionLabel = slotActionLabel(bucket.name);

  return (
    <div
      data-completeness-target={`bucket:${bucket.id}`}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        background: slotMet ? "#f0fdf4" : "#faf7f1",
        border: slotMet ? "1.5px solid #86efac" : "1px solid rgba(0,0,0,0.1)",
        transition: "background 160ms ease, border-color 160ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <label style={{ ...label, marginBottom: 0, flex: 1, color: slotMet ? "#14532d" : "#1c1917" }}>
          {slotMet ? `✓ ${bucket.name}` : bucket.name}
        </label>
        {hint ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
              ...(hint.met ? { color: "#166534" } : { color: "#44403c" }),
            }}
          >
            {hint.text}
          </span>
        ) : slotMet ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#166534", whiteSpace: "nowrap" }}>
            {done} added
          </span>
        ) : null}
      </div>
      {bucket.helper ? (
        <p style={{ ...helperText, fontSize: 12, margin: "2px 0 0" }}>{bucket.helper}</p>
      ) : null}
      {isExpenseReceiptBucket(bucket.name) ? (
        <p style={{ ...helperText, fontSize: 12, margin: "2px 0 0" }}>{RECEIPT_PHOTO_TIP}</p>
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
        onReplace={(id) => {
          onRemove(id);
          libraryRef.current?.click();
        }}
        accent={accent}
        allowVideo={Boolean(bucket.accept?.includes("video"))}
        slotLabel={actionLabel}
        showQuickSlots={false}
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

/** Uploaded slots get a solid green frame. Empty tiles stay a quiet hairline. */
function photoSlotFrame(state: Photo["state"]): CSSProperties {
  switch (state) {
    case "done":
      return {
        border: "3px solid #166534",
        boxShadow: "0 0 0 3px rgba(22, 101, 52, 0.28)",
      };
    case "failed":
      return { border: "3px solid #9b2c14" };
    case "uploading":
      return { border: "1px solid rgba(0,0,0,0.12)" };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/** Solid chip so "Uploaded" stays readable on a bright photo. Not a washed overlay. */
function photoStatusChip(state: Photo["state"]): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 26,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.01em",
    color: "#fff",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.35)",
  };
  switch (state) {
    case "done":
      return { ...base, background: "#166534" };
    case "failed":
      return { ...base, background: "#9b2c14" };
    case "uploading":
      return { ...base, background: "rgba(20, 24, 26, 0.88)" };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function PhotoGrid({
  photos,
  onAdd,
  onTake,
  onRemove,
  onKeep,
  onRetake,
  onReplace,
  accent,
  allowVideo = false,
  slotLabel,
  showQuickSlots = true,
}: {
  photos: Photo[];
  onAdd: () => void;
  onTake: () => void;
  onRemove: (id: string) => void;
  onKeep?: (id: string) => void;
  onRetake?: (id: string) => void;
  onReplace?: (id: string) => void;
  accent: string;
  allowVideo?: boolean;
  slotLabel?: string;
  showQuickSlots?: boolean;
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
  const donePhotos = photos.filter((p) => p.state === "done");
  const done = donePhotos.length;
  const atCap = photos.length >= PHOTO_CAP;
  const mediaWord = allowVideo ? "photos/videos" : "photos";

  return (
    <div>
      {showQuickSlots ? (
        <div
          role="group"
          aria-label="Suggested demo photo slots"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            margin: "6px 0 10px",
          }}
        >
          {DEFAULT_QUICK_PHOTO_SLOTS.map((slot, idx) => {
            const matched = donePhotos[idx];
            const filled = Boolean(matched);
            return (
              <button
                key={slot.key}
                type="button"
                onClick={onTake}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 52,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: filled ? "1.5px solid #166534" : "1.5px dashed #a8a29e",
                  background: filled ? "#f0fdf4" : "#faf7f1",
                  color: filled ? "#14532d" : "#1c1917",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "left",
                  cursor: "pointer",
                  touchAction: "manipulation",
                }}
              >
                {matched?.previewUrl && !matched.file.type.startsWith("video/") ? (
                  <img
                    src={matched.previewUrl}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                <span style={{ lineHeight: 1.2 }}>
                  {filled ? `✓ ${slot.doneLabel}` : slot.addLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p
        style={{
          color: "#44403c",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          opacity: 1,
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
                  opacity: p.state === "done" ? 1 : 0.55,
                  ...photoSlotFrame(p.state),
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
                  opacity: p.state === "done" ? 1 : 0.55,
                  ...photoSlotFrame(p.state),
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 10,
                  background: p.state === "done" ? "#e7f6df" : "#e7e5e4",
                  ...photoSlotFrame(p.state),
                }}
              />
            )}
            <span style={photoStatusChip(p.state)}>
              {p.state === "done"
                ? isVideo
                  ? "✓ Video"
                  : "✓ Uploaded"
                : p.state === "failed"
                  ? "Failed"
                  : "Uploading"}
            </span>
            <button onClick={() => onRemove(p.id)} style={photoRemove} aria-label="Remove photo">
              ×
            </button>
          </div>
          {p.check && !p.check.dismissed && p.check.message ? (
            <div
              style={{
                marginTop: 6,
                borderRadius: 8,
                padding: p.check.kind === "warn" ? "6px 8px" : "4px 0",
                background: p.check.kind === "warn" ? "#fffbeb" : "transparent",
                border: p.check.kind === "warn" ? "1px solid #f59e0b" : "none",
                color:
                  p.check.kind === "warn"
                    ? "#78350f"
                    : p.check.kind === "ok"
                      ? "#166534"
                      : "#44403c",
              }}
            >
              <p style={{ fontSize: 12, margin: 0, lineHeight: 1.35 }}>{p.check.message}</p>
              {p.check.kind === "warn" || p.check.kind === "unavailable" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {p.check.kind === "warn" && onRetake ? (
                    <button
                      type="button"
                      onClick={() => onRetake(p.id)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid #d97706",
                        background: "#fff",
                        color: "#92400e",
                        cursor: "pointer",
                      }}
                    >
                      Retake
                    </button>
                  ) : null}
                  {p.check.kind === "warn" && onReplace ? (
                    <button
                      type="button"
                      onClick={() => onReplace(p.id)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid #d6d3c8",
                        background: "#fff",
                        color: "#44403c",
                        cursor: "pointer",
                      }}
                    >
                      Replace
                    </button>
                  ) : null}
                  {onKeep ? (
                    <button
                      type="button"
                      onClick={() => onKeep(p.id)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 6px",
                        border: "none",
                        background: "transparent",
                        color: "#57534e",
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      Keep
                    </button>
                  ) : null}
                </div>
              ) : onKeep ? (
                <button
                  type="button"
                  onClick={() => onKeep(p.id)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    marginTop: 4,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    color: "#57534e",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Dismiss
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
              {slotLabel ? `${slotLabel} (Library)` : allowVideo ? "Upload media" : "Upload photos"}
            </button>
            <button
              type="button"
              onClick={onTake}
              style={{
                ...tile,
                border: "2px dashed rgba(0,0,0,0.22)",
                fontSize: 13,
                color: "inherit",
                opacity: 1,
              }}
            >
              {slotLabel ? `${slotLabel} (Camera)` : allowVideo ? "Take photo/video" : "Take photo"}
            </button>
          </>
        ) : null}
      </div>
      <p style={{ color: "#44403c", fontSize: 12, opacity: 1, margin: "6px 0 0" }}>
        {atCap
          ? `Limit ${PHOTO_CAP} ${mediaWord}. Remove one to add another.`
          : allowVideo
            ? "You can select many photos or videos from your library."
            : "You can select many from your library. iPhone photos are fine."}
      </p>
    </div>
  );
}

