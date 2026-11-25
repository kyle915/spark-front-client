/**
 * Which workspace a Staffing Board shift belongs to, and what the client
 * picker should start on.
 *
 * The board loads every client an admin can see, but people open it from a
 * workspace and expect that workspace's week first. Shift tenant ids arrive as
 * Relay global ids ("TenantType:39" in base64); the signed-in workspace id can
 * be either that or a bare "39", so both sides are reduced to the integer key.
 */

/** Integer key for a tenant id given as "39" or a base64 "TenantType:39". */
export function tenantKey(id: string | null | undefined): string | null {
  const raw = (id ?? "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;
  try {
    const decoded = atob(raw);
    const m = /^[A-Za-z]+:(\d+)$/.exec(decoded);
    if (m) return m[1];
  } catch {
    /* not base64 */
  }
  return null;
}

/** "All clients" in the picker. */
export const ALL_CLIENTS = "";

/**
 * The picker's starting value: the current workspace when there is one,
 * otherwise every client.
 */
export function defaultClientScope(currentTenantId: string | null | undefined): string {
  return tenantKey(currentTenantId) ?? ALL_CLIENTS;
}

export interface ClientOption {
  key: string;
  name: string;
}

/**
 * One option per client on the board, sorted by name. The current workspace
 * is always listed, even in a week where it has no shifts, so the default
 * selection never points at a missing option.
 */
export function clientOptions(
  shifts: ReadonlyArray<{ tenantId?: string | null; brandName: string }>,
  current: { key: string | null; fallbackName: string },
): ClientOption[] {
  const byKey = new Map<string, string>();
  for (const s of shifts) {
    const k = tenantKey(s.tenantId);
    if (k && !byKey.has(k)) byKey.set(k, s.brandName || "Unnamed client");
  }
  if (current.key && !byKey.has(current.key)) {
    byKey.set(current.key, current.fallbackName);
  }
  return [...byKey.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
