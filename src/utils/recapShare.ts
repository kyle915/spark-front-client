import { recapPublicUrl } from "@/utils/publicHosts";

/**
 * Public recap share URL. Token is minted by Recap.shareToken /
 * CustomRecap.shareToken (TimestampSigner). The page at /r/:token
 * fetches GET {API}/api/public/recap/<token> — no login required.
 * Host is admin (staff) or client (portal) — never spark.
 */
export function recapShareUrl(token: string): string {
  return recapPublicUrl(token);
}
