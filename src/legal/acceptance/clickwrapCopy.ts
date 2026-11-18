/** Copy + formatting shared by the Terms clickwrap and its tests. */

export const CHECKBOX_LABEL =
  "I agree to the Terms of Service and Acceptable Use Policy, and I've read the Privacy Policy";

export const DOCUMENT_ORDER = ["terms", "aup", "privacy"];

/** "2026-11-17" → "November 17, 2026" (no time zone shift). */
export function formatLegalVersion(version: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (!m) return version;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const month = months[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : version;
}
