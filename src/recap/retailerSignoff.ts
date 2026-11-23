/** Clerk sign-off field types. Other brands never send these unless they opt in. */

export function isSignatureType(type: string | null | undefined): boolean {
  return (type || "").trim().toLowerCase() === "signature";
}

export function isLetterType(type: string | null | undefined): boolean {
  return (type || "").trim().toLowerCase() === "letter";
}

/** One A–Z letter, or "" when the keystroke was not a letter. */
export function letterValue(raw: string): string {
  const match = raw.toUpperCase().match(/[A-Z]/);
  return match ? match[0] : "";
}

export function signatureSrc(value: string | null | undefined): string | null {
  const text = (value || "").trim();
  return text.startsWith("data:image/png;base64,") ? text : null;
}

const CLERK_NAME = /^(?=[\p{L}])[\p{L} .'-]{1,40}$/u;

export function clerkFirstNameValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Matches the API: a name, not a number, at most 40 characters. */
export function clerkFirstNameError(value: string, required = true): string | null {
  const name = clerkFirstNameValue(value);
  if (!name) return required ? "Enter the clerk's first name." : null;
  if (!CLERK_NAME.test(name)) return "Enter the clerk's first name.";
  return null;
}

export function signatureError(value: string, required = true): string | null {
  const text = value.trim();
  if (!text) return required ? "The store clerk needs to sign." : null;
  if (!signatureSrc(text)) {
    return "That signature couldn't be read. Ask the clerk to sign again.";
  }
  return null;
}
