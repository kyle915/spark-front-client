import {
  scrollToCompletenessTarget,
  type CompletenessItem,
} from "./checkinCompleteness";
import { computeCompletionSummary } from "./oneHandedCheckin";
import { StrokeCheckBadge } from "@/motion/ProgressMoments";

export function RecapCompletionBar({
  totalCheckpoints,
  items,
}: {
  totalCheckpoints: number;
  items: CompletenessItem[];
}) {
  const summary = computeCompletionSummary({
    totalCheckpoints,
    remainingItems: items.length,
  });
  const done = items.length === 0;
  const nextItem = items[0] ?? null;

  return (
    <div
      role="region"
      aria-label="Recap completion progress"
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        background: done ? "#f0fdf4" : "#ffffff",
        border: done ? "1px solid #86efac" : "1px solid rgba(0,0,0,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            color: done ? "#166534" : "#1c1917",
          }}
        >
          {done ? <StrokeCheckBadge done accent="#166534" size={18} /> : null}
          {summary.label}
        </span>
        {nextItem ? (
          <button
            type="button"
            onClick={() => scrollToCompletenessTarget(nextItem.target)}
            style={{
              border: "none",
              background: "transparent",
              color: "#1c1917",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              whiteSpace: "nowrap",
            }}
          >
            Jump to next
          </button>
        ) : null}
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${summary.pct}%`,
            height: "100%",
            borderRadius: 999,
            background: done ? "#166534" : "#14160f",
            transition: "width 180ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Tappable pre-submit checklist on the walk-up recap.
 *
 * Mirrors what Submit already checks (plus advisory photo-bucket and
 * receipt nudges). Tapping a row scrolls to that field and focuses it.
 * It never disables Submit — failed/offline photos still file by the
 * existing rules.
 */
export function RecapCompletenessChecklist({ items }: { items: CompletenessItem[] }) {
  if (items.length === 0) {
    return (
      <p
        aria-live="polite"
        style={{
          margin: 0,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(46,125,50,0.35)",
          background: "rgba(46,125,50,0.08)",
          color: "#1c1917",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <StrokeCheckBadge done accent="#166534" size={20} />
        <span>Everything&apos;s filled in — ready to submit.</span>
      </p>
    );
  }
  return (
    <div
      aria-label="Before you submit"
      style={{
        border: "1px solid rgba(0,0,0,0.14)",
        borderRadius: 14,
        background: "#fff",
        padding: "12px 14px",
      }}
    >
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1c1917" }}>
        Before you submit — {items.length} thing{items.length === 1 ? "" : "s"} to check
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#44403c" }}>
        Tap one to jump to it. You can still submit with photos missing.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 10,
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToCompletenessTarget(item.target)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 48,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.16)",
              background: "#faf7f1",
              color: "#1c1917",
              fontSize: 14,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <StrokeCheckBadge done={false} size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Photo-quality nudges with Retake (remove + shoot again) / Keep. */
export function PhotoQualityWarnings({
  warnings,
  onKeep,
  onRetake,
}: {
  warnings: { photoId: string; message: string; name: string }[];
  onKeep: (photoId: string) => void;
  onRetake: (photoId: string) => void;
}) {
  if (!warnings.length) return null;
  return (
    <div
      style={{
        border: "1px solid #EF5A2A",
        borderRadius: 14,
        background: "#fff",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Check these photos while you&apos;re still here</p>
      {warnings.map((w) => (
        <div key={w.photoId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>{w.name || "Photo"}</strong> — {w.message}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => onRetake(w.photoId)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "transparent",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => onKeep(w.photoId)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 10,
                border: "none",
                background: "#f2f3ee",
                color: "#0A0B0D",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Keep
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
