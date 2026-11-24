import { isWalkupPlaceholderEmail, walkupPhoneFromEmail } from "@/utils/clientSafeBaName";

/**
 * How a roster row names and places a BA.
 *
 * A BA who first came in through a walk-up check-in link is stored under a
 * synthetic `checkin-<phone>@walkup.spark` email. That address is an internal
 * key, not a way to reach anyone, so it is never shown: such a BA is named by
 * their phone and placed by the market (and brand) of their last shift.
 */

export type TalentSource = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  lastWorkedMarket?: string | null;
  lastWorkedTenant?: string | null;
};

/** "(312) 771-9621" from any 10- or 11-digit US number; "" otherwise. */
export function formatPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return (raw ?? "").trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** A real, contactable email — never the walk-up placeholder. */
export function displayEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  return e && !isWalkupPlaceholderEmail(e) ? e : "";
}

/** The BA's phone, from the profile or (walk-ups) the placeholder key. */
export function talentPhone(src: TalentSource): string {
  return formatPhone(src.phone) || walkupPhoneFromEmail(src.email);
}

export function talentName(src: TalentSource): string {
  const name = [src.firstName, src.lastName].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
  return name || talentPhone(src) || displayEmail(src.email) || "BA";
}

/** "Austin, TX · Liquid Death" — where they last worked, else the home city. */
export function talentPlace(src: TalentSource, homeCity: string): string {
  const last = [src.lastWorkedMarket, src.lastWorkedTenant]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return last || homeCity;
}

/** Search text: name, place, real email and phone digits. */
export function talentMatches(src: TalentSource & { college?: string | null }, homeCity: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const hay = [
    talentName(src),
    talentPlace(src, homeCity),
    homeCity,
    src.college ?? "",
    displayEmail(src.email),
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 3) {
    const phoneDigits = talentPhone(src).replace(/\D/g, "");
    if (phoneDigits.includes(qDigits)) return true;
  }
  return false;
}
