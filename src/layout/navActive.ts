/** Prefix match: `/plans` owns `/plans/123`; `/` only owns itself. */
export const isActive = (path: string | undefined, pathname: string) => {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
};

type ActiveItem = { to?: string; clientTo?: string };

/**
 * The one nav item that owns the current page: the longest matching path.
 * Prefix matching alone lit two rows at once (e.g. Settings and Calendar
 * Sync on /settings/calendar).
 */
export const pickActivePath = (
  sections: ReadonlyArray<{ items: ReadonlyArray<ActiveItem> }>,
  pathname: string,
  isClient: boolean,
): string | null => {
  let best: string | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      const to = isClient && item.clientTo ? item.clientTo : item.to;
      if (!to || !isActive(to, pathname)) continue;
      if (best === null || to.length > best.length) best = to;
    }
  }
  return best;
};
