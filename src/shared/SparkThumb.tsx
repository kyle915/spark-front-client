import { useEffect, useRef, useState } from "react";

/**
 * A grid thumbnail that never sits there as a blank gray box.
 *
 * - While the image loads, the tile shows the shared shimmer
 *   (`.skeleton-block`) instead of an empty placeholder.
 * - If the thumbnail fails (resize endpoint, expired private-media token,
 *   a HEIC rewrite with no JPEG twin), it retries the next source in
 *   `sources` — usually the full-resolution original.
 * - When every source fails, it says so in words ("Photo unavailable")
 *   rather than leaving an empty tile.
 *
 * Fills its parent: give the parent the size / aspect ratio.
 */
export type SparkThumbProps = {
  /** Candidate URLs, best first (e.g. thumbnail, then original). */
  sources: readonly (string | null | undefined)[];
  alt: string;
  className?: string;
  /** Text shown when no source loads. */
  unavailableLabel?: string;
};

const nextThumbSource = (
  sources: readonly (string | null | undefined)[],
  failed: number,
): string | null => {
  const usable = Array.from(
    new Set(sources.filter((s): s is string => Boolean(s && s.trim()))),
  );
  return usable[failed] ?? null;
};

export function SparkThumb({
  sources,
  alt,
  className = "",
  unavailableLabel = "Photo unavailable",
}: SparkThumbProps) {
  const [failed, setFailed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const key = sources.join("|");

  // New photo → start over.
  useEffect(() => {
    setFailed(0);
    setLoaded(false);
  }, [key]);

  const src = nextThumbSource(sources, failed);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [src]);

  if (!src) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-xs"
        style={{
          background: "rgba(var(--spark-ink-rgb),0.04)",
          color: "var(--spark-text-meta)",
        }}
        role="img"
        aria-label={alt}
      >
        {unavailableLabel}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!loaded ? (
        <div className="skeleton-block absolute inset-0" style={{ borderRadius: 0 }} aria-hidden />
      ) : null}
      <img
        ref={imgRef}
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setFailed((n) => n + 1);
        }}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
    </div>
  );
}

export default SparkThumb;
