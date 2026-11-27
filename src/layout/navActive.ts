import { HUB_PARENT_BY_PREFIX } from "@/shared/sparkHubNav";

/** Prefix match: `/plans` owns `/plans/123`; `/` only owns itself. */
export const isActive = (path: string | undefined, pathname: string) => {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
};

type ActiveItem = { to?: string; clientTo?: string };

/**
 * The one nav item that owns the current page: the longest matching path,
 * falling back to consolidated hub parent routes (Schedule, Reports, Photos)
 * when on a sibling sub-tab URL.
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
  if (best) return best;

  for (const hub of HUB_PARENT_BY_PREFIX) {
    const matchesHub = hub.prefixes.some((p) => isActive(p, pathname));
    if (!matchesHub) continue;
    for (const section of sections) {
      for (const item of section.items) {
        const to = isClient && item.clientTo ? item.clientTo : item.to;
        if (to === hub.hubPath) return to;
      }
    }
  }
  return null;
};
