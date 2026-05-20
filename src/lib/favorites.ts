/**
 * Favorites — localStorage v1.
 *
 * Tracks the set of Ambassador IDs the admin has starred. v1 persists
 * to localStorage per-tenant. When the backend lands an
 * `Ambassador.is_favorited` field + toggle mutation, swap the helpers
 * here for GraphQL calls — the consumer shape stays the same.
 */

const KEY = (tenantId: string) => `@spark.favorites/${tenantId}`;

export const loadFavorites = (tenantId: string | null): Set<string> => {
  if (!tenantId) return new Set();
  try {
    const raw = localStorage.getItem(KEY(tenantId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
};

export const saveFavorites = (
  tenantId: string | null,
  ids: Set<string>,
): void => {
  if (!tenantId) return;
  try {
    localStorage.setItem(KEY(tenantId), JSON.stringify([...ids]));
  } catch {
    /* quota / private mode — ignore */
  }
};

export const toggleFavorite = (
  tenantId: string | null,
  id: string,
): Set<string> => {
  const next = new Set(loadFavorites(tenantId));
  if (next.has(id)) next.delete(id);
  else next.add(id);
  saveFavorites(tenantId, next);
  return next;
};
