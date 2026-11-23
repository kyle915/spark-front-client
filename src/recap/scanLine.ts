/** One Scan row: who, activation, date, status, engagements. */
export function scanRecapLine(input: {
  who: string;
  activation: string;
  date: string;
  status: string;
  engagements: number | null;
}): string {
  const who = input.who.trim() || "Unattributed";
  const activation = input.activation.trim() || "Activation";
  const date = input.date.trim() || "No date";
  const status = input.status.trim() || "—";
  const engagements =
    input.engagements == null
      ? "—"
      : `${input.engagements.toLocaleString("en-US")} ${
          input.engagements === 1 ? "engagement" : "engagements"
        }`;
  return `${who} · ${activation} · ${date} · ${status} · ${engagements}`;
}
