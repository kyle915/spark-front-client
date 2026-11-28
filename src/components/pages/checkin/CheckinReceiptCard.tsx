import React from "react";
import type {
  CheckinSyncPillState,
  CheckinSyncTone,
  ShiftReceiptMetrics,
} from "./checkinReceiptAndSync";

const TONE_PALETTE: Record<
  CheckinSyncTone,
  { bg: string; fg: string; border: string; dot: string }
> = {
  synced: {
    bg: "rgba(236, 253, 245, 0.96)",
    fg: "#065f46",
    border: "#a7f3d0",
    dot: "#10b981",
  },
  draft: {
    bg: "rgba(255, 255, 255, 0.96)",
    fg: "#292524",
    border: "#d6d3d1",
    dot: "#78716c",
  },
  offline: {
    bg: "rgba(255, 251, 235, 0.97)",
    fg: "#92400e",
    border: "#fcd34d",
    dot: "#d97706",
  },
  attention: {
    bg: "rgba(254, 242, 242, 0.97)",
    fg: "#991b1b",
    border: "#fca5a5",
    dot: "#dc2626",
  },
};

export const CheckinSyncPill: React.FC<{ state: CheckinSyncPillState }> = ({
  state,
}) => {
  if (!state.visible) return null;
  const pal = TONE_PALETTE[state.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 8,
        zIndex: 18,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          pointerEvents: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.01em",
          background: pal.bg,
          color: pal.fg,
          border: `1px solid ${pal.border}`,
          boxShadow: "0 4px 14px rgba(28, 25, 23, 0.08)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: pal.dot,
            flexShrink: 0,
          }}
        />
        <span>{state.label}</span>
      </span>
    </div>
  );
};

export const CheckinDoneCheck: React.FC = () => (
  <svg
    className="spark-done-mark"
    width="40"
    height="40"
    viewBox="0 0 36 36"
    fill="none"
    aria-hidden="true"
    style={{
      margin: "0 auto 8px",
      display: "block",
      color: "#1c1917",
    }}
  >
    <circle cx="18" cy="18" r="15" style={{ stroke: "#1c1917" }} />
    <path d="M11.5 18.5 16 23l8.5-9.5" style={{ stroke: "#1c1917" }} />
  </svg>
);

export const ShiftReceiptCard: React.FC<{
  metrics: ShiftReceiptMetrics;
  dateAndPlace?: string;
  punchLine?: string;
}> = ({ metrics, dateAndPlace, punchLine }) => {
  const cells = metrics.showSamplesAndPhotos
    ? [
        { label: "Hours", value: metrics.hoursLabel },
        { label: "Samples", value: metrics.samplesLabel },
        { label: "Photos filed", value: metrics.photosLabel },
      ]
    : [{ label: "Hours logged", value: metrics.hoursLabel }];

  return (
    <div
      role="region"
      aria-label="Shift receipt summary"
      style={{
        marginTop: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: "#fafaf9",
        border: "1px solid #e7e5e4",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingBottom: 10,
          borderBottom: "1px dashed #d6d3d1",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#57534e",
          }}
        >
          Shift Receipt
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
            background: metrics.statusBadge.includes("Offline")
              ? "#fef3c7"
              : "#ecfdf5",
            color: metrics.statusBadge.includes("Offline")
              ? "#92400e"
              : "#065f46",
          }}
        >
          {metrics.statusBadge}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
          gap: 10,
          padding: "12px 0",
        }}
      >
        {cells.map((c) => (
          <div key={c.label} style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11.5,
                color: "#78716c",
                fontWeight: 500,
              }}
            >
              {c.label}
            </div>
            <div
              className="tab-num"
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: "#1c1917",
                letterSpacing: "-0.02em",
                marginTop: 2,
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {dateAndPlace || punchLine ? (
        <div
          style={{
            paddingTop: 10,
            borderTop: "1px dashed #d6d3d1",
            fontSize: 12.5,
            color: "#57534e",
            lineHeight: 1.45,
          }}
        >
          {dateAndPlace ? <div>{dateAndPlace}</div> : null}
          {punchLine ? (
            <div className="tab-num" style={{ color: "#78716c", marginTop: 2 }}>
              {punchLine}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
