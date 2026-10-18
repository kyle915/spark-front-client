import { useEffect, useState } from "react";
import { thumbUrl } from "@/utils/thumb";

export type PhotoLightboxItem = {
  name?: string;
  url: string;
  /** Optional pre-sized thumbnail for the filmstrip; derived from `url` when absent. */
  thumb?: string;
  caption?: string;
};

const C = {
  text: "var(--spark-text, #f2f3ee)",
  lime: "var(--spark-lime, #c5f546)",
  border: "var(--spark-border, #1f2418)",
  surface: "var(--spark-surface, #11140e)",
  muted: "rgba(255,255,255,0.55)",
  faint: "rgba(255,255,255,0.4)",
} as const;

/**
 * Shared recap + campaign photo overlay.
 * Esc / ← / →, click-to-zoom, thumb strip. No slideshow or share chrome.
 */
export function PhotoLightbox({
  photos,
  index,
  onClose,
  onStep,
  loop = false,
}: {
  photos: ReadonlyArray<PhotoLightboxItem>;
  index: number;
  onClose: () => void;
  onStep: (next: number) => void;
  loop?: boolean;
}) {
  const photo = photos[index];
  const last = photos.length - 1;
  const hasPrev = loop ? photos.length > 1 : index > 0;
  const hasNext = loop ? photos.length > 1 : index < last;
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onStep(loop ? (index - 1 + photos.length) % photos.length : index - 1);
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onStep(loop ? (index + 1) % photos.length : index + 1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(3, z + 0.5));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(1, z - 0.5));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasNext, hasPrev, index, loop, onClose, onStep, photos.length]);

  if (!photo) return null;

  const arrowBtn: React.CSSProperties = {
    background: "rgba(10,13,9,0.6)",
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 9999,
    width: 44,
    height: 44,
    fontSize: 22,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flex: "0 0 auto",
  };

  const stepPrev = () =>
    onStep(loop ? (index - 1 + photos.length) % photos.length : index - 1);
  const stepNext = () =>
    onStep(loop ? (index + 1) % photos.length : index + 1);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-4"
      style={{ background: "rgba(10,13,9,0.78)", backdropFilter: "blur(10px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || photo.name || `Photo ${index + 1} of ${photos.length}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close"
        className="fixed top-4 right-4 z-[71]"
        style={{
          background: "rgba(10,13,9,0.6)",
          color: C.text,
          border: `1px solid ${C.border}`,
          borderRadius: 9999,
          width: 40,
          height: 40,
          fontSize: 20,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-3 sm:gap-4 min-h-0 flex-1"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      >
        {hasPrev ? (
          <button type="button" onClick={stepPrev} aria-label="Previous photo" style={arrowBtn}>
            ‹
          </button>
        ) : (
          <span aria-hidden style={{ width: 44, flex: "0 0 auto" }} />
        )}

        <figure
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: "min(90vw, 1100px)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              overflow: zoom > 1 ? "auto" : "hidden",
              maxWidth: "100%",
              maxHeight: "72vh",
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              background: C.surface,
            }}
          >
            <img
              src={photo.url}
              alt={photo.caption || photo.name || `Photo ${index + 1}`}
              onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
              style={{
                maxWidth: zoom === 1 ? "100%" : "none",
                maxHeight: zoom === 1 ? "72vh" : "none",
                width: zoom > 1 ? `${zoom * 100}%` : "auto",
                objectFit: "contain",
                display: "block",
                cursor: zoom === 1 ? "zoom-in" : "zoom-out",
                transformOrigin: "center top",
              }}
            />
          </div>
          {(photo.caption || photo.name) && (
            <figcaption
              style={{
                marginTop: 12,
                fontSize: 13,
                color: C.muted,
                textAlign: "center",
                maxWidth: 720,
              }}
            >
              {photo.caption || photo.name}
            </figcaption>
          )}
          <p
            className="mono"
            style={{
              marginTop: 8,
              fontSize: 10,
              letterSpacing: "0.14em",
              color: C.faint,
            }}
          >
            {index + 1} / {photos.length}
            {zoom > 1 ? ` · ${zoom}×` : " · CLICK TO ZOOM"}
          </p>
        </figure>

        {hasNext ? (
          <button type="button" onClick={stepNext} aria-label="Next photo" style={arrowBtn}>
            ›
          </button>
        ) : (
          <span aria-hidden style={{ width: 44, flex: "0 0 auto" }} />
        )}
      </div>

      {photos.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex gap-2 overflow-x-auto mt-3 max-w-[min(90vw,1100px)] pb-1"
        >
          {photos.map((p, i) => {
            const on = i === index;
            return (
              <button
                key={`${p.url}-${i}`}
                type="button"
                onClick={() => onStep(i)}
                aria-label={`Photo ${i + 1}`}
                style={{
                  width: 48,
                  height: 48,
                  padding: 0,
                  borderRadius: 10,
                  overflow: "hidden",
                  border: on ? `2px solid ${C.lime}` : `1px solid ${C.border}`,
                  opacity: on ? 1 : 0.7,
                  flex: "0 0 auto",
                  background: C.surface,
                  cursor: "pointer",
                }}
              >
                <img
                  src={p.thumb || thumbUrl(p.url, 400) || p.url}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PhotoLightbox;
