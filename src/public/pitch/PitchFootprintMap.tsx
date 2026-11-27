import React, { useMemo, useState } from "react";
import type { PitchFootprintState } from "./pitchDeckTypes";
import {
  blendFootprintColor,
  FOOTPRINT_MAP_H,
  FOOTPRINT_MAP_W,
  FOOTPRINT_SHAPES,
  STATE_BY_CODE,
} from "./pitchFootprintGeometry";

export const PitchFootprintMap: React.FC<{
  states: readonly PitchFootprintState[];
  accentHex?: string;
}> = ({ states, accentHex = "#2B4C08" }) => {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const { byCode, maxVal } = useMemo(() => {
    const map = new Map(states.map((s) => [s.state.toUpperCase(), s]));
    const max = Math.max(
      1,
      ...states.map((s) => Math.max(s.visits || 0, s.stores || 0)),
    );
    return { byCode: map, maxVal: max };
  }, [states]);

  const hovered = hoveredCode ? byCode.get(hoveredCode) : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${FOOTPRINT_MAP_W} ${FOOTPRINT_MAP_H}`}
        role="img"
        aria-label={`US activation footprint across ${states.length} ${
          states.length === 1 ? "state" : "states"
        }`}
        className="w-full h-auto block rounded-xl"
        style={{ background: "#ffffff" }}
      >
        {FOOTPRINT_SHAPES.map((shape) => {
          const row = byCode.get(shape.code);
          const ratio = row ? (row.visits || row.stores || 1) / maxVal : 0;
          const fill = row ? blendFootprintColor(ratio, accentHex) : "#EEF0E8";
          const isHovered = hoveredCode === shape.code;
          return (
            <path
              key={shape.code}
              d={shape.d}
              fill={fill}
              stroke={isHovered ? "#14160F" : "#FFFFFF"}
              strokeWidth={isHovered ? 2 : 1.2}
              style={{
                cursor: row ? "pointer" : "default",
                transition: "fill 0.15s ease, stroke 0.15s ease",
              }}
              onMouseEnter={() => {
                if (row) setHoveredCode(shape.code);
              }}
              onMouseLeave={() => setHoveredCode(null)}
            />
          );
        })}
        {FOOTPRINT_SHAPES.map((shape) => {
          const row = byCode.get(shape.code);
          if (!row) return null;
          const ratio = (row.visits || row.stores || 1) / maxVal;
          const textFill = ratio > 0.55 ? "#FFFFFF" : "#14160F";
          return (
            <g key={`lbl-${shape.code}`} style={{ pointerEvents: "none" }}>
              <text
                x={shape.cx}
                y={shape.cy - 2}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={textFill}
              >
                {shape.code}
              </text>
              <text
                x={shape.cx}
                y={shape.cy + 10}
                textAnchor="middle"
                fontSize={9.5}
                fontWeight={600}
                fill={textFill}
                opacity={0.86}
              >
                {row.visits}v
              </text>
            </g>
          );
        })}
      </svg>

      {hovered ? (
        <div
          className="absolute bottom-2 left-2 rounded-lg px-3 py-2 text-xs shadow-sm pointer-events-none"
          style={{
            background: "rgba(255,255,255,0.96)",
            border: "1px solid #dcddd5",
            color: "#14160f",
          }}
        >
          <p className="font-semibold">
            {STATE_BY_CODE[hovered.state]?.name ?? hovered.state}
          </p>
          <p className="tab-num" style={{ color: "#5c6154" }}>
            {hovered.stores} {hovered.stores === 1 ? "door" : "doors"} ·{" "}
            {hovered.visits} {hovered.visits === 1 ? "visit" : "visits"} ·{" "}
            {hovered.samples.toLocaleString()} samples ·{" "}
            {hovered.repUnits.toLocaleString()} rep units
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default PitchFootprintMap;
