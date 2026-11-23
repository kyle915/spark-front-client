/**
 * Pure helpers for Ignite staff vs brand-client role gating.
 * Kept free of React / authStore so unit tests don't pull Relay.
 */

const IGNITE_EMAIL_RE = /@igniteproductions\.co$/i;

/** Mirrors API domain check used for Ignite staff preview (front only). */
export function emailGrantsIgniteAdmin(
  email: string | null | undefined,
): boolean {
  return Boolean(email && IGNITE_EMAIL_RE.test(email.trim()));
}

/**
 * True only for the platform Spark Admin role. Do not use substring
 * "admin" — that would let a hypothetical Brand Admin / brand_admin
 * name unlock the Admin/Client dongle. RoleType on the clients schema
 * exposes `name` (not slug); name is "Spark Admin".
 */
export function roleGrantsSparkAdminToggle(
  roleName: string | null | undefined,
): boolean {
  const name = (roleName ?? "").toString().trim().toLowerCase();
  return name === "spark admin" || name === "spark-admin";
}
