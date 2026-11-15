import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  orderInlineActions,
  orderMenuActions,
  type RecapStickyAction,
} from "./recapStickyActions";

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

const menuItems = (menu: HTMLElement | null): HTMLButtonElement[] =>
  menu
    ? Array.from(
        menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
      ).filter((el) => !el.disabled && el.offsetParent !== null)
    : [];

/**
 * Fixed bottom bar for admin/ops recap detail — keeps Approve / Share
 * reachable while scrolling photo-first content. Dark Spark ops chrome.
 * Do not mount on client detail or public `/r/:token`.
 *
 * Always one row. `children` are the primary actions (Approve) and stay in
 * the bar at every width; `actions` are secondary and collapse into a single
 * "More" menu below the `xl` breakpoint. If a very long label still does not
 * fit, the row scrolls sideways rather than wrapping over the page.
 */
export function RecapStickyOpsBar({
  children,
  label = "Actions",
  queueNav,
  actions = [],
}: {
  children: ReactNode;
  label?: string;
  queueNav?: RecapStickyQueueNav | null;
  actions?: RecapStickyAction[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  // Close on outside press; move focus into the menu when it opens.
  useEffect(() => {
    if (!menuOpen) return;
    menuItems(menuRef.current)[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const closeMenu = (refocus: boolean) => {
    setMenuOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
      return;
    }
    if (e.key === "Tab") {
      setMenuOpen(false);
      return;
    }
    const items = menuItems(menuRef.current);
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % items.length;
    else if (e.key === "ArrowUp")
      next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next >= 0) {
      e.preventDefault();
      items[next].focus();
    }
  };

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
      // Keys typed while the More menu is open belong to the menu.
      if (menuOpenRef.current) return;
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

  const toneClass = (tone: RecapStickyAction["tone"]) =>
    tone === "danger"
      ? " recap-sticky-ops-danger"
      : tone === "active"
        ? " recap-sticky-ops-active"
        : "";
  const inlineActions = orderInlineActions(actions);
  const menuActions = orderMenuActions(actions);
  const firstDangerKey = menuActions.find((a) => a.tone === "danger")?.key;

  return (
    <div
      ref={rootRef}
      className="recap-sticky-ops fixed left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1.5rem)]"
      role="toolbar"
      aria-label="Recap actions"
    >
      {menuOpen && menuActions.length > 0 ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="More recap actions"
          className="recap-sticky-ops-menu"
          onKeyDown={onMenuKeyDown}
        >
          {menuActions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              title={a.title}
              onClick={() => {
                closeMenu(true);
                a.onClick();
              }}
              className={`recap-sticky-ops-menu-item text-sm font-semibold${toneClass(
                a.tone,
              )}${a.phoneOnly ? " recap-sticky-ops-phone-only" : ""}${
                a.key === firstDangerKey && menuActions.length > 1
                  ? " recap-sticky-ops-menu-divided"
                  : ""
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="recap-sticky-ops-row flex flex-nowrap items-center gap-2 sm:gap-2.5">
        <span className="recap-sticky-ops-label text-xs hidden md:inline shrink-0">
          {label}
        </span>
        {queueNav && queueNav.total > 0 && (
          <div
            className="recap-sticky-ops-queue flex items-center gap-1.5 pr-2 shrink-0"
            role="group"
            aria-label="Review queue navigation"
          >
            <button
              type="button"
              disabled={!queueNav.prevHref || queueNav.pending}
              onClick={() => {
                if (queueNav.prevHref) queueNav.onNavigate(queueNav.prevHref);
              }}
              className="recap-sticky-ops-nav px-2 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap"
              title="Previous recap in queue ([ or k)"
              aria-label="Previous recap in queue"
            >
              ←<span className="hidden md:inline"> Prev</span>
            </button>
            <span className="recap-sticky-ops-count mono text-xs px-1 whitespace-nowrap">
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
              className="recap-sticky-ops-nav px-2 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap"
              title="Next recap in queue (] or j)"
              aria-label="Next recap in queue"
            >
              <span className="hidden md:inline">Next </span>→
            </button>
          </div>
        )}
        {inlineActions.length > 0 ? (
          <div className="recap-sticky-ops-inline items-center gap-1.5 shrink-0">
            {inlineActions.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={a.disabled}
                title={a.title}
                onClick={a.onClick}
                className={`recap-sticky-ops-btn px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap${toneClass(
                  a.tone,
                )}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
        {menuActions.length > 0 ? (
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((open) => !open)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                setMenuOpen(true);
              } else if (e.key === "Escape" && menuOpen) {
                e.preventDefault();
                closeMenu(true);
              }
            }}
            className="recap-sticky-ops-btn recap-sticky-ops-more px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap shrink-0"
            title="Share, edit, archive or delete this recap"
          >
            More
          </button>
        ) : null}
        <div className="recap-sticky-ops-primary flex flex-nowrap items-center gap-1.5 shrink-0 whitespace-nowrap">
          {children}
        </div>
        {queueNav && queueNav.total > 0 ? (
          // The shortcuts have always worked; nobody knew. Shown on wide
          // screens only — there is no keyboard to press on a phone.
          <span
            className="recap-sticky-ops-label text-xs hidden 2xl:inline shrink-0 whitespace-nowrap"
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
    </div>
  );
}

export default RecapStickyOpsBar;
