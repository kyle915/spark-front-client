import { useState, type CSSProperties } from "react";
import { card, helperText } from "./checkinStyles";
import {
  shelfStatusLabel,
  storePrepKitHasContent,
  type StorePrepKit,
} from "./storePrepKit";

const title: CSSProperties = { fontSize: 16, fontWeight: 700, margin: 0, color: "#1c1917" };

function riskStyles(level: "none" | "watch" | "high"): CSSProperties {
  switch (level) {
    case "high":
      return {
        border: "1px solid #b45309",
        background: "#fffbeb",
        color: "#78350f",
      };
    case "watch":
      return {
        border: "1px solid #a16207",
        background: "#fefce8",
        color: "#713f12",
      };
    case "none":
      return {
        border: "1px solid #166534",
        background: "#f0fdf4",
        color: "#14532d",
      };
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

/**
 * Pre-shift Store Prep Kit on walk-up check-in: logistics, last shelf, SKUs,
 * training links, and a light stock-risk badge. Collapsed by default.
 */
export function StorePrepKitCard({
  kit,
  accent,
}: {
  kit: StorePrepKit | null | undefined;
  accent: string;
}) {
  const [open, setOpen] = useState(true);
  if (!storePrepKitHasContent(kit) || !kit) return null;

  const risk = kit.stockRisk;
  const showRisk = risk && (risk.level === "high" || risk.level === "watch" || risk.level === "none");

  return (
    <section style={{ ...card, marginBottom: 12 }} aria-label="Store prep kit">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          textAlign: "left",
          minHeight: 44,
        }}
      >
        <p style={title}>Store Prep Kit</p>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#44403c" }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          {showRisk && risk ? (
            <div
              role="status"
              style={{
                ...riskStyles(risk.level),
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.4,
                fontWeight: 600,
              }}
            >
              {risk.reason}
            </div>
          ) : null}

          {kit.logisticsNotes.trim() ? (
            <div>
              <p style={{ ...helperText, fontWeight: 700, margin: 0, color: "#1c1917" }}>
                Store notes
              </p>
              <p style={{ ...helperText, margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
                {kit.logisticsNotes.trim()}
              </p>
            </div>
          ) : null}

          {kit.lastShelfVisit ? (
            <div>
              <p style={{ ...helperText, fontWeight: 700, margin: 0, color: "#1c1917" }}>
                Last shelf check
              </p>
              <p style={{ ...helperText, margin: "4px 0 0" }}>
                {shelfStatusLabel(kit.lastShelfVisit.productOnShelf)}
                {kit.lastShelfVisit.eventDate ? ` · ${kit.lastShelfVisit.eventDate}` : ""}
                {kit.lastShelfVisit.priceTagVisible === "yes"
                  ? " · Price tag seen"
                  : kit.lastShelfVisit.priceTagVisible === "no"
                    ? " · No price tag"
                    : ""}
              </p>
            </div>
          ) : null}

          {kit.skus.length ? (
            <div>
              <p style={{ ...helperText, fontWeight: 700, margin: 0, color: "#1c1917" }}>
                SKUs for this shift
              </p>
              <p style={{ ...helperText, margin: "4px 0 0" }}>{kit.skus.join(" · ")}</p>
            </div>
          ) : null}

          {kit.resources.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ ...helperText, fontWeight: 700, margin: 0, color: "#1c1917" }}>
                BA materials
              </p>
              {kit.resources.map((r, i) => (
                <a
                  key={`${r.url}-${i}`}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${accent}55`,
                    background: `${accent}14`,
                    color: "#1c1917",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                    minHeight: 44,
                  }}
                >
                  {r.label}
                  {r.note ? (
                    <span style={{ display: "block", fontWeight: 500, fontSize: 12, color: "#44403c" }}>
                      {r.note}
                    </span>
                  ) : null}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
