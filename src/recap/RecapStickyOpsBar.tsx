import { useEffect, type ReactNode } from "react";

export type RecapStickyQueueNav = {
  index: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
  onNavigate: (href: string) => void;
  /** True while the next recap page is still resolving. */
  pending?: boolean;
  /** Manual Approve & next — `a` keyboard shortcut when set. */
  onApproveNext?: (() => void) | null;
};

/**
 * Fixed bottom bar for admin/ops recap detail — keeps Approve / Share
 * reachable while scrolling photo-first content. Dark Spark ops chrome
 * (lime/orange). Do not mount on client detail or public `/r/:token`.
 */
export function RecapStickyOpsBar({
  children,
  label = "ACTIONS",
  queueNav,
}: {
  children: ReactNode;
  label?: string;
  queueNav?: RecapStickyQueueNav | null;
}) {
  useEffect(() => {
    if (!queueNav) return;
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (queueNav.pending) return;
      if (e.key === "[" || e.key === "k") {
        if (queueNav.prevHref) {
          e.preventDefault();
          queueNav.onNavigate(queueNav.prevHref);
        }
      } else if (e.key === "]" || e.key === "j") {
        if (queueNav.nextHref) {
          e.preventDefault();
          queueNav.onNavigate(queueNav.nextHref);
        }
      } else if ((e.key === "a" || e.key === "A") && queueNav.onApproveNext) {
        e.preventDefault();
        queueNav.onApproveNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [queueNav]);

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
      {queueNav && queueNav.total > 0 && (
        <div
          className="flex items-center gap-1.5 pr-2 shrink-0"
          style={{ borderRight: "1px solid var(--spark-border)" }}
          aria-label="Review queue navigation"
        >
          <button
            type="button"
            disabled={!queueNav.prevHref || queueNav.pending}
            onClick={() => {
              if (queueNav.prevHref) queueNav.onNavigate(queueNav.prevHref);
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold transition"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
              opacity: queueNav.prevHref ? 1 : 0.4,
            }}
            title="Previous recap in queue ([ or k)"
          >
            ← Prev
          </button>
          <span
            className="mono text-[11px] px-1 whitespace-nowrap"
            style={{
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {queueNav.pending ? "Loading…" : `${queueNav.index} of ${queueNav.total}`}
          </span>
          <button
            type="button"
            disabled={!queueNav.nextHref || queueNav.pending}
            onClick={() => {
              if (queueNav.nextHref) queueNav.onNavigate(queueNav.nextHref);
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold transition"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
              opacity: queueNav.nextHref ? 1 : 0.4,
            }}
            title="Next recap in queue (] or j)"
          >
            Next →
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {children}
      </div>
    </div>
  );
}

export default RecapStickyOpsBar;
