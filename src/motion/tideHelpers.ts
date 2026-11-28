export interface TideToneMeta {
  status: "healthy" | "near_cap" | "at_cap";
  fill: string;
  badgeBg: string;
  badgeFg: string;
  statusText: string;
}

export function resolveTideTone(
  percent: number,
  fallbackColor?: string,
): TideToneMeta {
  const clamped = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 0;
  if (clamped >= 95) {
    return {
      status: "at_cap",
      fill: "var(--spark-orange, #ef5a2a)",
      badgeBg: "var(--pilot-danger-bg, rgba(239, 90, 42, 0.14))",
      badgeFg: "var(--pilot-danger-fg, var(--spark-orange, #ef5a2a))",
      statusText: "At cap",
    };
  }
  if (clamped >= 80) {
    return {
      status: "near_cap",
      fill: "#f59e0b",
      badgeBg: "var(--pilot-warn-bg, rgba(245, 158, 11, 0.14))",
      badgeFg: "var(--pilot-warn-fg, #d97706)",
      statusText: "Approaching cap",
    };
  }
  return {
    status: "healthy",
    fill: fallbackColor || "var(--spark-lime)",
    badgeBg: "var(--pilot-ok-bg, rgba(148, 224, 64, 0.14))",
    badgeFg: "var(--pilot-ok-fg, var(--spark-ok-ink))",
    statusText: "Within allowance",
  };
}
