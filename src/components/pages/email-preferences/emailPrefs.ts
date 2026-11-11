export type EmailPref = {
  category: string;
  label: string;
  description: string;
  emailEnabled: boolean;
};

/** Apply one saved choice to the list without touching the others. */
export const applyEmailPref = (
  prefs: ReadonlyArray<EmailPref>,
  category: string,
  emailEnabled: boolean,
): EmailPref[] =>
  prefs.map((p) => (p.category === category ? { ...p, emailEnabled } : p));

export const emailPrefsSummary = (prefs: ReadonlyArray<EmailPref>): string => {
  const off = prefs.filter((p) => !p.emailEnabled).length;
  if (prefs.length === 0) return "";
  if (off === 0) return "You're getting every email.";
  if (off === prefs.length) return "All optional emails are off.";
  return `${off} of ${prefs.length} turned off.`;
};
