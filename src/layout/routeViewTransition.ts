export const ROUTE_VIEW_TRANSITION_MS = 140;

/**
 * Normalize a pathname to its top-level sidebar hub family so sub-tab switches
 * within the same hub stay instant while cross-hub navigations get a subtle
 * 140ms View Transition cross-fade.
 */
export function hubRootSegment(pathname: string): string {
  const clean = (pathname || "/").split("?")[0].split("#")[0].trim();
  if (
    clean === "/" ||
    clean === "/dashboard" ||
    clean === "/client-dashboard" ||
    clean.startsWith("/dashboard/")
  ) {
    return "home";
  }
  if (
    clean.startsWith("/schedule") ||
    clean.startsWith("/calendar") ||
    clean.startsWith("/upcoming") ||
    clean.startsWith("/today") ||
    clean.startsWith("/live-board") ||
    clean.startsWith("/staffing")
  ) {
    return "schedule";
  }
  if (
    clean.startsWith("/recap") ||
    clean.startsWith("/photos") ||
    clean.startsWith("/approvals")
  ) {
    return "recaps";
  }
  if (clean.startsWith("/account-map") || clean.startsWith("/store/")) {
    return "map";
  }
  if (
    clean.startsWith("/insights") ||
    clean.startsWith("/reports") ||
    clean.startsWith("/shelf-voice")
  ) {
    return "insights";
  }
  if (
    clean.startsWith("/talent") ||
    clean.startsWith("/people") ||
    clean.startsWith("/favorites") ||
    clean.startsWith("/timesheet")
  ) {
    return "people";
  }
  const seg = clean.split("/").filter(Boolean)[0];
  return seg ? seg.toLowerCase() : "home";
}

export function isHubSwitch(fromPathname: string, toPathname: string): boolean {
  if (!fromPathname || !toPathname || fromPathname === toPathname) return false;
  return hubRootSegment(fromPathname) !== hubRootSegment(toPathname);
}

export function prefersReducedMotionSafe(
  win?: { matchMedia?: (query: string) => { matches: boolean } } | null,
): boolean {
  try {
    const target = win ?? (typeof window !== "undefined" ? window : null);
    return Boolean(target?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

export interface ViewTransitionHandle {
  finished?: Promise<unknown>;
  skipTransition?: () => void;
}

export interface DocumentWithViewTransition {
  startViewTransition?: (updateCallback: () => void) => ViewTransitionHandle;
  visibilityState?: string;
  querySelector?: (selector: string) => Element | null;
}

export function canStartViewTransition(
  doc?: DocumentWithViewTransition | null,
  win?: { matchMedia?: (query: string) => { matches: boolean } } | null,
): boolean {
  if (prefersReducedMotionSafe(win)) return false;
  const d =
    doc ??
    (typeof document !== "undefined"
      ? (document as unknown as DocumentWithViewTransition)
      : null);
  if (!d || typeof d.startViewTransition !== "function") return false;
  if (d.visibilityState && d.visibilityState !== "visible") return false;
  if (d.querySelector?.("[data-vaul-drawer]")) return false;
  return true;
}
