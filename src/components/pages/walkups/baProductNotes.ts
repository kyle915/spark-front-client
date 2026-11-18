/** Staff-facing label for how a BA's product question was answered. */
export function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "answered":
      return "Answered";
    case "not_in_notes":
      return "Not in the notes — add it";
    case "no_material":
      return "No notes yet";
    case "ai_unavailable":
      return "AI unavailable";
    default:
      return outcome.replace(/_/g, " ");
  }
}

/** "just now" / "20 min ago" / "3 h ago" / "Nov 9" for an ISO timestamp. */
export function askedWhen(iso: string, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (Number.isNaN(ms)) return "";
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
