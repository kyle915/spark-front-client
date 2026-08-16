import { useCallback, useState } from "react";
import type { CampaignReportPhoto } from "./CampaignReportView";
import { PhotoLightbox } from "@/shared/PhotoLightbox";

/**
 * Photo highlights gallery for a campaign report.
 *
 * Rendered inside the shared <CampaignReportView>, so it surfaces on BOTH the
 * authenticated admin report (/report-view/:requestId) and the public/client
 * shareable page (/report/:token) from one mount point.
 *
 * Renders a responsive thumbnail grid (2 / 3 / 4 columns by breakpoint) of
 * lazy-loaded, cover-cropped images. Clicking a thumb opens a plain-React
 * lightbox overlay (no external library): a blurred backdrop with the full
 * image centered, the caption (when present), and prev/next arrows.
 *
 *   • Close: backdrop click, the ✕ button, or Escape.
 *   • Step: the ‹ / › arrow buttons or the keyboard ← / → keys (clamped — it
 *     does not wrap past the first/last photo).
 *
 * The overlay chrome (fixed inset, rgba scrim + backdrop blur, stop-propagation
 * inner panel, Escape-to-close) mirrors the AskAiModal pattern in
 * src/components/ai/AskAiButton.tsx.
 *
 * Empty state: when there are no photos it renders nothing — no empty gallery
 * frame, no header.
 *
 * Styling uses the spark-v2 dark tokens via inline CSS-var fallbacks (matching
 * <CampaignReportView>) so it stays on-brand even on the un-themed public page.
 */

const C = {
  surface: "var(--spark-surface, #11140e)",
  surface2: "var(--spark-surface-2, #161a12)",
  border: "var(--spark-border, #1f2418)",
  text: "var(--spark-text, #f2f3ee)",
  lime: "var(--spark-lime, #c5f546)",
  muted: "rgba(255,255,255,0.55)",
  faint: "rgba(255,255,255,0.4)",
} as const;

const cardStyle: React.CSSProperties = {
  background: `linear-gradient(180deg, ${C.surface}, ${C.surface2})`,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    className="mono"
    style={{
      fontSize: 10,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: C.faint,
      margin: 0,
    }}
  >
    {children}
  </p>
);

// ─── Gallery ────────────────────────────────────────────────────────────
const CampaignPhotoHighlights: React.FC<{
  photos: ReadonlyArray<CampaignReportPhoto>;
}> = ({ photos }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback((next: number) => setOpenIndex(next), []);

  // Empty state: render nothing — no header, no empty frame.
  if (!photos || photos.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionLabel>Photo highlights</SectionLabel>
      <div
        style={{
          display: "grid",
          gap: 12,
          // Responsive: ~2 cols on phones, 3 on tablets, 4 on desktop. The
          // auto-fill min keeps thumbs from stretching too wide on big screens.
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          marginTop: 10,
        }}
      >
        {photos.map((p, i) => (
          <figure
            key={`${p.url}-${i}`}
            style={{ ...cardStyle, margin: 0, padding: 0, overflow: "hidden" }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={
                p.caption ? `Enlarge photo: ${p.caption}` : `Enlarge photo ${i + 1}`
              }
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <img
                src={p.url}
                alt={p.caption || `Activation photo ${i + 1}`}
                loading="lazy"
                style={{
                  width: "100%",
                  height: 180,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </button>
            {p.caption ? (
              <figcaption
                style={{
                  padding: "0.6rem 0.8rem",
                  fontSize: 12,
                  color: C.muted,
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                {p.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      {openIndex !== null ? (
        <PhotoLightbox
          photos={photos.map((p) => ({ url: p.url, caption: p.caption ?? undefined }))}
          index={openIndex}
          onClose={close}
          onStep={step}
        />
      ) : null}
    </section>
  );
};

export default CampaignPhotoHighlights;
