import { useEffect, useState } from "react";

/**
 * Best-effort in-browser HEIC → JPEG converter. Renders as an <img>
 * when conversion succeeds; falls back to a "OPEN HEIC →" tile (parent
 * `<a target="_blank">` opens the original on click).
 *
 * Conversion is intentionally lazy — we only fetch + transcode when the
 * tile actually mounts. heic2any pulls libheif WASM (~700KB) so we want
 * users who never open the recaps view to skip the download.
 */
export const HeicImage: React.FC<{
  url: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ url, className, style }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let revokeUrl: string | null = null;
    (async () => {
      try {
        // mode:"cors" makes the failure explicit if the bucket isn't
        // CORS-configured (rather than failing silently in opaque mode).
        const res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        const { default: heic2any } = await import("heic2any");
        const out = (await heic2any({
          blob,
          toType: "image/jpeg",
        })) as Blob;
        if (cancelled) return;
        revokeUrl = URL.createObjectURL(out);
        setSrc(revokeUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [url]);

  if (failed) {
    return (
      <div
        className={`w-full h-full grid place-items-center ${className ?? ""}`}
        style={style}
      >
        <div className="text-center">
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            HEIC
          </span>
          <p
            className="mono mt-1"
            style={{
              fontSize: 8,
              letterSpacing: "0.14em",
              color: "var(--spark-text-meta)",
            }}
          >
            OPEN →
          </p>
        </div>
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`w-full h-full grid place-items-center ${className ?? ""}`}
        style={style}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--spark-text-meta)",
          }}
        >
          DECODING…
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={className}
      style={style}
    />
  );
};

export default HeicImage;
