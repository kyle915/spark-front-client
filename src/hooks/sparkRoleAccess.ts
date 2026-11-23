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
 * True for platform staff roles that may use the Admin/Client dongle.
 * Accepts exact "Spark Admin" / "spark-admin" and the legacy People /
 * SparkTeam invite label "admin". Do not use substring "admin" — that
 * would unlock Brand Admin / brand_admin. RoleType exposes `name`.
 */
export function roleGrantsSparkAdminToggle(
  roleName: string | null | undefined,
): boolean {
  const name = (roleName ?? "").toString().trim().toLowerCase();
  return (
    name === "spark admin" ||
    name === "spark-admin" ||
    name === "admin"
  );
}
