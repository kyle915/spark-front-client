import { retailerMatchesSearch } from "@/utils/retailerOptionLabel";

export type StoreSuggestion = { name: string; address: string };

/** Roster accounts whose trading name or address contains every typed word. */
export function matchingStores(
  stores: readonly StoreSuggestion[],
  query: string,
  limit = 8,
): StoreSuggestion[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const hits: StoreSuggestion[] = [];
  for (const store of stores) {
    if (!store.address.trim()) continue;
    if (!retailerMatchesSearch(store, q)) continue;
    hits.push(store);
    if (hits.length >= limit) break;
  }
  return hits;
}

/** A picker label that names the store. Walk-in event titles are not names. */
export function storeNameForPicker(store: StoreSuggestion): string {
  const name = store.name.trim();
  const address = store.address.trim();
  if (!name) return "";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(name)) return "";
  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(name)) return "";
  if (address && name.toLowerCase().includes(address.toLowerCase())) return "";
  return name;
}
