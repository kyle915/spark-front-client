/**
 * Ambassador names as shown to brand (client) users.
 *
 * Clients see "First L." — never a full name, never an email. Admins keep
 * the full value. Email-shaped values (walk-up placeholder identities such
 * as checkin-5551234567@walkup.spark, or a roster row with no name) collapse
 * to the generic "Ambassador".
 */
export function clientSafeBaName(raw: string | null | undefined): string {
  const name = (raw ?? "").trim();
  if (!name) return "";
  if (name.includes("@")) return "Ambassador";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

/** True for the synthetic email a walk-up check-in identity is stored under. */
export function isWalkupPlaceholderEmail(
  email: string | null | undefined,
): boolean {
  return /@walkup\.spark$/i.test((email ?? "").trim());
}

/**
 * Pull the phone number out of a walk-up placeholder email
 * (checkin-3127719621@walkup.spark → "(312) 771-9621"). Returns "" when the
 * value is not a placeholder or has no usable digits.
 */
export function walkupPhoneFromEmail(email: string | null | undefined): string {
  if (!isWalkupPlaceholderEmail(email)) return "";
  const digits = (email ?? "").split("@")[0].replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return "";
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}
