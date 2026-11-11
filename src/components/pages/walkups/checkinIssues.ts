/** "last 20 min ago" / "last 3 h ago" / "last Nov 9" for an ISO timestamp. */
export const issueWhen = (iso: string, now: Date = new Date()): string => {
  if (!iso) return "";
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (Number.isNaN(ms)) return "";
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "last just now";
  if (minutes < 60) return `last ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `last ${hours} h ago`;
  return `last ${then.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
};
