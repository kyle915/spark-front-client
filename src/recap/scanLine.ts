/**
 * Scan rows on the recaps list are one line: who filed it, the activation,
 * the date, the status, and engagements. Sold and the card chrome stay on
 * Cards.
 */
export function scanRecapLine(parts: {
  who: string;
  activation: string;
  date: string;
  status: string;
  engagements: number | null;
}): string {
  const who = parts.who.trim() || "Unattributed";
  const activation = parts.activation.trim() || "Activation";
  const date = parts.date.trim() || "No date";
  const status = parts.status.trim() || "Status";
  const engagements =
    parts.engagements == null
      ? "— engagements"
      : `${parts.engagements.toLocaleString("en-US")} ${
          parts.engagements === 1 ? "engagement" : "engagements"
        }`;
  return [who, activation, date, status, engagements].join(" · ");
}
