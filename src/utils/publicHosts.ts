/**
 * Canonical production hosts for links we mint (check-in, recap share,
 * public request form). Never use window.location.origin in production —
 * leftover spark.igniteproductions.co tabs would text BAs a spark. URL
 * even though that host 301s to client.
 *
 * Localhost keeps the current origin so Kyle can open the same links
 * against vite. Everything else (spark leftover, previews, unknown
 * hosts) mints the real client or admin host.
 */

export const CLIENT_ORIGIN = "https://client.igniteproductions.co";
export const ADMIN_ORIGIN = "https://admin.igniteproductions.co";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function windowOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

function windowHostname(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hostname;
}

/** Client portal origin. Localhost stays local; every other host is client. */
export function clientOrigin(): string {
  const host = windowHostname();
  if (host && isLocalHostname(host)) return windowOrigin() as string;
  return CLIENT_ORIGIN;
}

/** Admin origin. Localhost stays local; every other host is admin. */
export function adminOrigin(): string {
  const host = windowHostname();
  if (host && isLocalHostname(host)) return windowOrigin() as string;
  return ADMIN_ORIGIN;
}

/**
 * Public recap leave-behind host.
 * Always client. in production — field phones have failed to resolve
 * admin. (ERR_NAME_NOT_RESOLVED). spark. 301s here anyway.
 */
export function recapShareOrigin(): string {
  const host = windowHostname();
  if (host && isLocalHostname(host)) return windowOrigin() as string;
  return CLIENT_ORIGIN;
}

function withPath(origin: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

export function checkinUrl(code: string): string {
  return withPath(clientOrigin(), `/checkin/${code}`);
}

export function sparkFormUrl(slug: string): string {
  return withPath(clientOrigin(), `/spark-form/${slug}`);
}

export function recapPublicUrl(token: string): string {
  return withPath(recapShareOrigin(), `/r/${encodeURIComponent(token)}`);
}

/** True when this first paint should boot the public field entry (no GSI / shell). */
export function isPublicFieldPath(pathname: string): boolean {
  return /^\/(checkin|spark-form|r|training)(\/|$)/.test(pathname);
}
