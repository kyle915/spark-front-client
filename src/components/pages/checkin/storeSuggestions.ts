import { retailerMatchesSearch } from "@/utils/retailerOptionLabel";

export type StoreSuggestion = {
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
};

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

/** Typed text that reads like a street address: a number, then a street. */
export function looksLikeAddress(query: string): boolean {
  return /\d{1,6}\s+\S*[A-Za-z]{2,}/.test(query.trim());
}

/**
 * What to tell someone who typed an address the list doesn't know.
 *
 * A store we have never heard of is normal — ambassadors work new accounts
 * all the time, and staff map them afterwards. Saying nothing made people
 * think the address had been refused, so they picked a listed store that
 * was not where they were standing.
 */
export function newLocationNote(
  query: string,
  hits: readonly StoreSuggestion[],
): string | null {
  if (hits.length > 0 || !looksLikeAddress(query)) return null;
  return "New location. That's fine: continue and your shift is logged at this address.";
}

