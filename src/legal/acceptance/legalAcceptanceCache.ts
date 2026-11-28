/**
 * Local acceptance cache for `LegalGate` so returning signed-in tabs render
 * `<AuthenticatedShell>` immediately on frame 1 while `fetchLegalStatus()`
 * revalidates in the background.
 *
 * Server-side `LegalAcceptanceGate` still enforces acceptance on every GraphQL
 * operation, and `noteLegalGate()` in `environment.ts` re-opens the clickwrap
 * immediately if `currentVersion` was bumped.
 */

const LEGAL_CACHE_KEY = "@spark.legalAccepted.v1";

interface CachedLegalRecord {
  userId: string;
  version: string;
  acceptedAtMs: number;
}

function canUseStorage(): boolean {
  return (
    typeof localStorage !== "undefined" &&
    typeof localStorage.getItem === "function" &&
    typeof localStorage.setItem === "function" &&
    typeof localStorage.removeItem === "function"
  );
}

export function readCachedLegalAcceptance(): CachedLegalRecord | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LEGAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedLegalRecord> | null;
    if (
      parsed &&
      typeof parsed.userId === "string" &&
      parsed.userId.length > 0 &&
      typeof parsed.version === "string" &&
      parsed.version.length > 0
    ) {
      return {
        userId: parsed.userId,
        version: parsed.version,
        acceptedAtMs:
          typeof parsed.acceptedAtMs === "number" ? parsed.acceptedAtMs : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function hasCachedLegalAcceptance(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const record = readCachedLegalAcceptance();
  return Boolean(record && record.userId === userId);
}

export function writeCachedLegalAcceptance(
  userId: string | null | undefined,
  version: string | null | undefined,
): void {
  if (!userId || !version || !canUseStorage()) return;
  try {
    const payload: CachedLegalRecord = {
      userId,
      version,
      acceptedAtMs: Date.now(),
    };
    localStorage.setItem(LEGAL_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore storage quota / private mode */
  }
}

export function clearCachedLegalAcceptance(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(LEGAL_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
