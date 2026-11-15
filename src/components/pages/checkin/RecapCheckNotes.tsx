import { useEffect, useRef } from "react";
import { scrollToCompletenessTarget } from "./checkinCompleteness";
import type { RecapCheckItem } from "./recapCheck";

/**
 * What the recap check found, shown after a tap on Submit.
 *
 * Advice only. Tapping a note jumps to its field; "Submit as is" files the
 * recap unchanged. Nothing here can stop a recap going in.
 */
export function RecapCheckNotes({
  items,
  busy,
  onSubmitAsIs,
}: {
  items: RecapCheckItem[];
  busy: boolean;
  onSubmitAsIs: () => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const shown = items.length > 0;
  useEffect(() => {
    if (shown) box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [shown]);
  if (!shown) return null;
  return (
    <div
      ref={box}
      role="status"
      aria-live="polite"
      aria-label="Before this goes in"
      style={{
        border: "1px solid rgba(0,0,0,0.2)",
        borderRadius: 14,
        background: "#fff",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1c1917" }}>
          {items.length === 1 ? "One thing to double-check" : `${items.length} things to double-check`}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#44403c" }}>
          Fix anything that is off. If it is all right, submit as is.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, index) =>
          item.fieldId ? (
            <button
              key={`${item.code}-${index}`}
              type="button"
              onClick={() => scrollToCompletenessTarget(item.fieldId as string)}
              style={{
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
              {item.message}
            </button>
          ) : (
            <p
              key={`${item.code}-${index}`}
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.16)",
                background: "#faf7f1",
                color: "#1c1917",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {item.message}
            </p>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={onSubmitAsIs}
        disabled={busy}
        style={{
          minHeight: 48,
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.2)",
          background: "transparent",
          color: "#1c1917",
          fontSize: 14,
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}
      >
        Submit as is
      </button>
    </div>
  );
}
