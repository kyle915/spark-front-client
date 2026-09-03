import type { ReactNode } from "react";

/**
 * Fixed bottom bar for admin/ops recap detail — keeps Approve / Share
 * reachable while scrolling photo-first content. Dark Spark ops chrome
 * (lime/orange). Do not mount on client detail or public `/r/:token`.
 */
export function RecapStickyOpsBar({
  children,
  label = "ACTIONS",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 max-w-[calc(100vw-1.5rem)]"
      style={{
        background: "rgba(10, 13, 9, 0.95)",
        border: "1px solid var(--spark-border)",
        boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
      }}
      role="toolbar"
      aria-label="Recap actions"
    >
      <span
        className="mono text-[11px] hidden sm:inline shrink-0"
        style={{
          letterSpacing: "0.16em",
          color: "var(--spark-lime)",
        }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {children}
      </div>
    </div>
  );
}

export default RecapStickyOpsBar;
