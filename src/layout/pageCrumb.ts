import { useEffect, useSyncExternalStore } from "react";

export type PageCrumb = { parent: string; title: string } | null;

let crumb: PageCrumb = null;
const listeners = new Set<() => void>();

export function setPageCrumb(next: PageCrumb) {
  crumb = next;
  listeners.forEach((listener) => listener());
}

export function usePageCrumb(): PageCrumb {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => crumb,
    () => null,
  );
}

/** Recap detail pages publish a human crumb and clear it on unmount. */
export function useRecapPageCrumb(title: string | null | undefined) {
  useEffect(() => {
    if (!title) {
      setPageCrumb(null);
      return;
    }
    setPageCrumb({ parent: "Recaps", title });
    return () => setPageCrumb(null);
  }, [title]);
}

const UUID_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export function looksLikeRouteId(segment: string): boolean {
  const compact = segment.replace(/[\s-]/g, "");
  if (UUID_RE.test(segment) || UUID_RE.test(compact)) return true;
  // Relay / hex ids that are clearly not words (e.g. 01A0011E437B…).
  return compact.length >= 16 && /^[0-9A-F]+$/i.test(compact);
}
