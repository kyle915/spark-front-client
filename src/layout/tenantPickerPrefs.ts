const RECENTS_KEY = "spark-tenant-recents";
const FAVORITES_KEY = "spark-tenant-favorites";
const MAX_RECENTS = 5;
const MAX_FAVORITES = 8;

let recentMemory: string[] = [];
let favoriteMemory: string[] = [];

function readUuidList(key: string, memory: string[], max: number): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return memory;
    const next = parsed
      .filter((row): row is string => typeof row === "string" && row.length > 0)
      .slice(0, max);
    if (key === RECENTS_KEY) recentMemory = next;
    else favoriteMemory = next;
    return next;
  } catch {
    return memory;
  }
}

function writeUuidList(key: string, next: string[]): void {
  if (key === RECENTS_KEY) recentMemory = next;
  else favoriteMemory = next;
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(next));
  } catch {
    // quota / private mode — prefs still work from memory
  }
}

export function loadTenantRecents(): string[] {
  return readUuidList(RECENTS_KEY, recentMemory, MAX_RECENTS);
}

export function rememberTenantRecent(uuid: string): string[] {
  const next = [
    uuid,
    ...loadTenantRecents().filter((id) => id !== uuid),
  ].slice(0, MAX_RECENTS);
  writeUuidList(RECENTS_KEY, next);
  return next;
}

export function clearTenantRecents(): void {
  recentMemory = [];
  try {
    globalThis.localStorage?.removeItem(RECENTS_KEY);
  } catch {
    /* ignore */
  }
}

export function loadTenantFavorites(): string[] {
  return readUuidList(FAVORITES_KEY, favoriteMemory, MAX_FAVORITES);
}

export function toggleTenantFavorite(uuid: string): string[] {
  const current = loadTenantFavorites();
  const next = current.includes(uuid)
    ? current.filter((id) => id !== uuid)
    : [uuid, ...current].slice(0, MAX_FAVORITES);
  writeUuidList(FAVORITES_KEY, next);
  return next;
}

export function clearTenantFavorites(): void {
  favoriteMemory = [];
  try {
    globalThis.localStorage?.removeItem(FAVORITES_KEY);
  } catch {
    /* ignore */
  }
}

export function tenantSearchHaystack(t: {
  name?: string | null;
  tenantSlug?: string | null;
  requestUrlName?: string | null;
}): string {
  return [t.name, t.tenantSlug, t.requestUrlName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function tenantMatchesQuery(
  t: {
    name?: string | null;
    tenantSlug?: string | null;
    requestUrlName?: string | null;
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return tenantSearchHaystack(t).includes(q);
}

export function tenantLetter(name: string | null | undefined): string {
  const ch = (name ?? "").trim().charAt(0).toUpperCase();
  return ch >= "A" && ch <= "Z" ? ch : "#";
}

export function groupTenantsByLetter<T extends { name?: string | null }>(
  tenants: T[],
): Array<{ letter: string; tenants: T[] }> {
  const sorted = [...tenants].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, {
      sensitivity: "base",
    }),
  );
  const map = new Map<string, T[]>();
  for (const t of sorted) {
    const letter = tenantLetter(t.name);
    const bucket = map.get(letter);
    if (bucket) bucket.push(t);
    else map.set(letter, [t]);
  }
  return Array.from(map.entries()).map(([letter, rows]) => ({
    letter,
    tenants: rows,
  }));
}

export const TENANT_PICKER_MAX_FAVORITES = MAX_FAVORITES;
export const TENANT_PICKER_MAX_RECENTS = MAX_RECENTS;
