export const AUTO_SYNC_INTERVAL_MS = 60_000;

/**
 * Formats live elapsed time since a BA clocked in (e.g. "2h 14m in", "38m in", "just in").
 */
export function formatElapsedSince(
  clockInIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!clockInIso) return "";
  const startMs = new Date(clockInIso).getTime();
  if (!Number.isFinite(startMs)) return "";
  const diffMs = nowMs - startMs;
  if (diffMs < 60_000) return "just in";
  const totalMins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours <= 0) return `${mins}m in`;
  return `${hours}h ${String(mins).padStart(2, "0")}m in`;
}

/**
 * Formats relative age since the last background sync ("just now", "1m ago").
 */
export function formatSyncAge(
  syncedAtMs: number,
  nowMs: number = Date.now(),
): string {
  const diffSec = Math.max(0, Math.floor((nowMs - syncedAtMs) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}
