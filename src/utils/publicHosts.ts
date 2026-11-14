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

export function jobBoardUrl(token: string): string {
  return withPath(clientOrigin(), `/jobs/${token}`);
}

export function sparkFormUrl(slug: string): string {
  return withPath(clientOrigin(), `/spark-form/${slug}`);
}

export type PublicFormLink = {
  slug: string;
  url: string;
  kind: "spark-form" | "checkin";
};

/**
 * The public URL clients and BAs actually use.
 *
 * Prefer the spark-form slug (`requestUrlName`) when the brand has one
 * (Torch, Liquid Death). Guerrilla sampling programs like Feel Free
 * never got a request form — BAs use the standing `/checkin/<code>`
 * link instead. Hide only when neither exists.
 */
export function resolvePublicFormLink(input: {
  requestUrlName?: string | null;
  checkinCode?: string | null;
}): PublicFormLink | null {
  const form = input.requestUrlName?.trim() ?? "";
  if (form) {
    return { slug: form, url: sparkFormUrl(form), kind: "spark-form" };
  }
  const code = input.checkinCode?.trim() ?? "";
  if (code) {
    return { slug: code, url: checkinUrl(code), kind: "checkin" };
  }
  return null;
}

export function recapPublicUrl(token: string): string {
  return withPath(recapShareOrigin(), `/r/${encodeURIComponent(token)}`);
}

/** Public campaign report leave-behind — same client. host as /r/:token. */
export function campaignReportPublicUrl(token: string): string {
  return withPath(recapShareOrigin(), `/report/${encodeURIComponent(token)}`);
}

/** Public consumer rebate / receipt upload — /c/:slug. */
export function receiptCampaignPublicUrl(slug: string): string {
  return withPath(clientOrigin(), `/c/${encodeURIComponent(slug)}`);
}

/** Public client invoice leave-behind — /invoice/:token. */
export function invoicePublicUrl(token: string): string {
  return withPath(clientOrigin(), `/invoice/${encodeURIComponent(token)}`);
}

/** Public client-live board — /live/:token. */
export function clientLivePublicUrl(token: string): string {
  return withPath(clientOrigin(), `/live/${encodeURIComponent(token)}`);
}

/** Staff request deep link for mention emails — always admin. in prod. */
export function adminRequestUrl(requestUuid: string): string {
  return withPath(adminOrigin(), `/request/view/${encodeURIComponent(requestUuid)}`);
}

/** True when this first paint should boot the public field entry (no GSI / shell). */
export function isPublicFieldPath(pathname: string): boolean {
  return (
    /^\/(checkin|spark-form|r|report|training|c|invoice|live|clock)(\/|$)/.test(pathname) ||
    /^\/jobs\/[^/]+/.test(pathname)
  );
}

/**
 * Where a check-in link opened on the admin host should go instead.
 *
 * Ambassadors belong on the client host: what the page saves on the phone
 * (their session, a clock-in queued while offline, a recap draft) is kept
 * per host, so a shift started on one host is invisible on the other.
 *
 * Returns null — stay put — off the admin host, off a check-in path, or
 * when this phone already holds check-in data on the admin host: moving
 * that person now would strand whatever they have saved here.
 */
export function checkinRedirectTarget(
  loc: { hostname: string; pathname: string; search: string; hash: string },
  storedKeys: ReadonlyArray<string>,
): string | null {
  if (loc.hostname !== new URL(ADMIN_ORIGIN).hostname) return null;
  if (!/^\/checkin(\/|$)/.test(loc.pathname)) return null;
  if (storedKeys.some((key) => key.includes("spark.checkin"))) return null;
  return `${CLIENT_ORIGIN}${loc.pathname}${loc.search}${loc.hash}`;
}

