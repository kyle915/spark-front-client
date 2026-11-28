/**
 * Zero-dependency state holder for idle & hover Relay warmup (`prefetchHotRelayData`).
 *
 * Kept separate from `prefetchHotRelayData.ts` so `authStore.ts` and
 * `environment.ts` can reset warmup state on logout / workspace switch without
 * statically pulling 6 Relay query ASTs (~300 kB) into the cold-boot bundle.
 */

let warmedKey: string | null = null;
const warmedIntentKeys = new Set<string>();

export function getWarmedHotRelayKey(): string | null {
  return warmedKey;
}

export function setWarmedHotRelayKey(key: string | null): void {
  warmedKey = key;
}

export function hasWarmedIntentKey(key: string): boolean {
  return warmedIntentKeys.has(key);
}

export function markWarmedIntentKey(key: string): void {
  warmedIntentKeys.add(key);
}

export function resetHotRelayDataPrefetch(): void {
  warmedKey = null;
  warmedIntentKeys.clear();
}
