/**
 * Marketing UTM capture for /onboarding.
 *
 * Mirrors ignite-webflow-assets `ig-routes.js` campaignValue rules so ads and
 * Spark marketing pages can deep-link into self-serve signup with attribution
 * that survives a short session and lands on the Close lead note.
 */

export const MARKETING_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
] as const;

export type MarketingUtmKey = (typeof MARKETING_UTM_KEYS)[number];

export type MarketingUtm = Partial<Record<MarketingUtmKey, string>>;

const STORAGE_KEY = "spark.onboarding.marketing.utm.v1";
const STORAGE_TTL_MS = 30 * 60 * 1000;

const CAMPAIGN_VALUE_RE = /^[a-z0-9][a-z0-9 ._~+-]{0,159}$/i;
const PHONE_SHAPED_RE = /^\+?[\d ().-]{7,}$/;

export function sanitizeCampaignValue(
  key: MarketingUtmKey,
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (!CAMPAIGN_VALUE_RE.test(value)) return null;
  if (key !== "utm_id" && PHONE_SHAPED_RE.test(value)) return null;
  return value;
}

export function readUtmFromSearchParams(
  params: URLSearchParams | { get: (key: string) => string | null },
): MarketingUtm {
  const out: MarketingUtm = {};
  for (const key of MARKETING_UTM_KEYS) {
    const value = sanitizeCampaignValue(key, params.get(key));
    if (value) out[key] = value;
  }
  return out;
}

export function hasAnyUtm(utm: MarketingUtm | null | undefined): boolean {
  if (!utm) return false;
  return MARKETING_UTM_KEYS.some((key) => Boolean(utm[key]));
}

interface StoredUtmRecord {
  at: number;
  values: MarketingUtm;
}

function readStoredUtm(now: number = Date.now()): MarketingUtm {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const prior = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || "null",
    ) as StoredUtmRecord | null;
    if (
      !prior ||
      typeof prior.at !== "number" ||
      now < prior.at ||
      now - prior.at >= STORAGE_TTL_MS ||
      !prior.values
    ) {
      return {};
    }
    return readUtmFromSearchParams(
      new URLSearchParams(
        Object.entries(prior.values).flatMap(([k, v]) =>
          v ? [[k, v]] : [],
        ),
      ),
    );
  } catch {
    return {};
  }
}

function writeStoredUtm(utm: MarketingUtm, now: number = Date.now()): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!hasAnyUtm(utm)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const record: StoredUtmRecord = { at: now, values: utm };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore quota / private mode
  }
}

/** Capture UTMs from the current URL (or resume a 30-minute session). */
export function captureOnboardingMarketingUtm(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  now: number = Date.now(),
): MarketingUtm {
  const fromUrl = readUtmFromSearchParams(searchParams);
  if (hasAnyUtm(fromUrl)) {
    writeStoredUtm(fromUrl, now);
    return fromUrl;
  }
  const stored = readStoredUtm(now);
  if (hasAnyUtm(stored)) {
    writeStoredUtm(stored, now);
  }
  return stored;
}

export function utmMutationVariables(utm: MarketingUtm): {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmId: string;
  utmContent: string;
  utmTerm: string;
} {
  return {
    utmSource: utm.utm_source || "",
    utmMedium: utm.utm_medium || "",
    utmCampaign: utm.utm_campaign || "",
    utmId: utm.utm_id || "",
    utmContent: utm.utm_content || "",
    utmTerm: utm.utm_term || "",
  };
}

/** Admin onboarding URL used by marketing CTAs (never client-facing billing). */
export const SPARK_ONBOARDING_BASE =
  "https://admin.igniteproductions.co/onboarding";

export function buildSparkOnboardingUrl(
  defaults: MarketingUtm,
  current?: URLSearchParams | null,
): string {
  const merged: MarketingUtm = { ...defaults };
  if (current) {
    const fromCurrent = readUtmFromSearchParams(current);
    for (const key of MARKETING_UTM_KEYS) {
      if (fromCurrent[key]) merged[key] = fromCurrent[key];
    }
  }
  const url = new URL(SPARK_ONBOARDING_BASE);
  for (const key of MARKETING_UTM_KEYS) {
    const value = merged[key];
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}
