import { useEffect, useRef, useState, type CSSProperties } from "react";
import { card, helperText } from "./checkinStyles";
import {
  shelfStatusLabel,
  storePrepKitHasContent,
  storePrepKitShouldStartOpen,
  storePrepKitShowsPinnedRisk,
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

function RiskBanner({
  risk,
}: {
  risk: NonNullable<StorePrepKit["stockRisk"]>;
}) {
  return (
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
  );
}

/**
 * Pre-shift Store Prep Kit on walk-up check-in: logistics, last shelf, SKUs,
 * training links, and a stock-risk badge. Stock risk stays above the fold;
 * the kit opens by default when risk is watch/high so BAs don't miss it.
 */
export function StorePrepKitCard({
  kit,
  accent,
}: {
  kit: StorePrepKit | null | undefined;
  accent: string;
}) {
  const riskWantsOpen = storePrepKitShouldStartOpen(kit);
  const [open, setOpen] = useState(riskWantsOpen);
  // Kit often arrives after identify (store chosen) while this card stays
  // mounted — open once when watch/high risk first shows up.
  const autoOpenedForRisk = useRef(riskWantsOpen);
  useEffect(() => {
    if (!riskWantsOpen || autoOpenedForRisk.current) return;
    autoOpenedForRisk.current = true;
    setOpen(true);
  }, [riskWantsOpen]);
  if (!storePrepKitHasContent(kit) || !kit) return null;

  const risk = kit.stockRisk;
  const showPinnedRisk = storePrepKitShowsPinnedRisk(kit);
  const detailCount =
    (kit.logisticsNotes.trim() ? 1 : 0) +
    (kit.lastShelfVisit ? 1 : 0) +
    (kit.skus.length ? 1 : 0) +
    (kit.resources.length ? 1 : 0);

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
        <div style={{ minWidth: 0 }}>
          <p style={title}>Store Prep Kit</p>
          {!open && detailCount > 0 ? (
            <p style={{ ...helperText, margin: "2px 0 0", color: "#57534e" }}>
              Logistics, shelf notes, SKUs &amp; BA materials
            </p>
          ) : null}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1c1917",
            flexShrink: 0,
            textDecoration: open ? "none" : "underline",
            textUnderlineOffset: 2,
          }}
        >
          {open ? "Hide" : "Open prep"}
        </span>
      </button>

      {/* Stock risk stays visible even when the kit is collapsed. */}
      {showPinnedRisk && risk && !open ? (
        <div style={{ marginTop: 10 }}>
          <RiskBanner risk={risk} />
        </div>
      ) : null}

      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          {showPinnedRisk && risk ? <RiskBanner risk={risk} /> : null}

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
