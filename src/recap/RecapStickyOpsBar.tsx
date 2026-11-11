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
 * reachable while scrolling photo-first content. Dark Spark ops chrome.
 * Do not mount on client detail or public `/r/:token`.
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
      className="recap-sticky-ops fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 max-w-[calc(100vw-1.5rem)]"
      role="toolbar"
      aria-label="Recap actions"
    >
      <span className="recap-sticky-ops-label mono text-[10px] hidden sm:inline shrink-0">
        {label}
      </span>
      {queueNav && queueNav.total > 0 && (
        <div
          className="recap-sticky-ops-queue flex items-center gap-1.5 pr-2 shrink-0"
          aria-label="Review queue navigation"
        >
          <button
            type="button"
            disabled={!queueNav.prevHref || queueNav.pending}
            onClick={() => {
              if (queueNav.prevHref) queueNav.onNavigate(queueNav.prevHref);
            }}
            className="recap-sticky-ops-nav px-2 py-1.5 rounded-lg text-xs font-semibold transition"
            title="Previous recap in queue ([ or k)"
          >
            ← Prev
          </button>
          <span className="recap-sticky-ops-count mono text-[11px] px-1 whitespace-nowrap">
            {queueNav.pending
              ? "Loading…"
              : `${queueNav.index} of ${queueNav.total}`}
          </span>
          <button
            type="button"
            disabled={!queueNav.nextHref || queueNav.pending}
            onClick={() => {
              if (queueNav.nextHref) queueNav.onNavigate(queueNav.nextHref);
            }}
            className="recap-sticky-ops-nav px-2 py-1.5 rounded-lg text-xs font-semibold transition"
            title="Next recap in queue (] or j)"
          >
            Next →
          </button>
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {children}
      </div>
      {queueNav && queueNav.total > 0 ? (
        // The shortcuts have always worked; nobody knew. Shown on wide
        // screens only — there is no keyboard to press on a phone.
        <span
          className="recap-sticky-ops-label mono text-[10px] hidden xl:inline shrink-0"
          aria-label={
            queueNav.onApproveNext
              ? "Keyboard: J next, K previous, A approve and go to the next recap"
              : "Keyboard: J next, K previous"
          }
        >
          <kbd>J</kbd>/<kbd>K</kbd> move
          {queueNav.onApproveNext ? (
            <>
              {" · "}
              <kbd>A</kbd> approve
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export default RecapStickyOpsBar;
