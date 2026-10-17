import type { CSSProperties } from "react";

// Shared check-in chrome styles, extracted from SparkCheckin.tsx in the step split.


/** Shared chrome, so an opens-a-tab button and an opens-a-viewer button match. */
export const resourceCard = (accent: string) =>
  ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    border: `1px solid ${accent}55`,
    background: `${accent}14`,
    color: "inherit",
    textDecoration: "none",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
    minHeight: 44,
  }) as const;


export const wrap: CSSProperties = {
  minHeight: "100dvh",
  background: "#faf7f1",
  color: "#1c1917",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "48px 20px 56px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
export const card: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 18,
  padding: 18,
};
export const h2: CSSProperties = { fontSize: 16, fontWeight: 700, margin: 0 };
export const label: CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 4,
  color: "#1c1917",
  opacity: 1,
};
export const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 12px",
  minHeight: 48,
  fontSize: 16,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#14181a",
  marginTop: 8,
  outline: "none",
};
export const errText: CSSProperties = { color: "#EF5A2A", fontSize: 13, marginTop: 10, marginBottom: 0 };
export const photoBadge: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  color: "#fff",
};
export const photoRemove: CSSProperties = {
  position: "absolute",
  top: -8,
  right: -8,
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "none",
  background: "#14181a",
  color: "#fff",
  fontSize: 18,
  lineHeight: "32px",
  cursor: "pointer",
  padding: 0,
  zIndex: 1,
};
export function primaryBtn(accent: string): CSSProperties {
  return {
    flex: 1,
    padding: "14px 16px",
    minHeight: 52,
    borderRadius: 12,
    border: "none",
    background: accent,
    color: "#0a0d09",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  };
}
export const secondaryBtn: CSSProperties = {
  flex: 1,
  padding: "14px 16px",
  minHeight: 52,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "transparent",
  color: "#14181a",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
