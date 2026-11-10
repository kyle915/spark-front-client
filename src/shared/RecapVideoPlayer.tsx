import { useEffect, useRef, useState } from "react";
import { recapVideoMime } from "@/utils/recapFileUrl";

const CANT_PLAY =
  "This clip can't play in Chrome — open in Safari or download.";

/**
 * In-page recap clip. The src should be the play endpoint (inline,
 * video/mp4), not a raw .mov tab. No download attribute — a failed HEVC
 * clip explains itself instead of silently saving a file.
 */
export function RecapVideoPlayer({
  src,
  fileUrl,
  name,
  onClose,
}: {
  src: string;
  fileUrl: string;
  name?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || message) return;
    const pending = el.play();
    if (pending) pending.catch(() => {});
  }, [message, src]);

  const mime = recapVideoMime(fileUrl || src);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(10,13,9,0.78)", backdropFilter: "blur(10px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={name || "Video"}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed top-4 right-4 z-[71]"
        style={{
          background: "rgba(10,13,9,0.6)",
          color: "var(--spark-text, #f2f3ee)",
          border: "1px solid var(--spark-border, #1f2418)",
          borderRadius: 9999,
          width: 40,
          height: 40,
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ✕
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 1100px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {message ? (
          <div
            className="rounded-2xl px-6 py-8 text-center"
            style={{
              background: "var(--spark-surface, #11140e)",
              border: "1px solid var(--spark-border, #1f2418)",
              color: "var(--spark-text, #f2f3ee)",
              maxWidth: 480,
            }}
          >
            <p className="text-sm font-semibold">{message}</p>
            {fileUrl ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold"
                style={{
                  background: "var(--spark-lime, #f2f3ee)",
                  color: "#0a0d09",
                  textDecoration: "none",
                }}
              >
                Open file
              </a>
            ) : null}
          </div>
        ) : (
          <video
            ref={videoRef}
            key={src}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload"
            onError={(event) => {
              const code = event.currentTarget.error?.code;
              setMessage(
                code === MediaError.MEDIA_ERR_NETWORK
                  ? "Couldn't load this clip. Try again."
                  : CANT_PLAY,
              );
            }}
            style={{
              width: "100%",
              maxHeight: "78vh",
              background: "#000",
              borderRadius: 16,
            }}
          >
            <source src={src} type={mime} />
          </video>
        )}
        {name ? (
          <p
            className="text-sm text-center"
            style={{ color: "var(--spark-text-secondary)", maxWidth: 720 }}
          >
            {name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
