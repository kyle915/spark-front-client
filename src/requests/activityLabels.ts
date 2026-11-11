/**
 * Plain-language labels for the request activity log (server
 * `RequestActivityLog.kind`). Unknown kinds fall back to a readable form so
 * a new server event type still shows up.
 */
const KIND_LABEL: Record<string, string> = {
  created: "Request created",
  updated: "Request updated",
  status_changed: "Status changed",
  ba_invited: "Ambassador invited",
  ba_accepted: "Ambassador accepted",
  ba_declined: "Ambassador declined",
  ba_removed: "Ambassador removed",
  recap_filed: "Recap filed",
  cloned_from: "Duplicated from another request",
  note_added: "Note added",
  nudge_sent: "Recap reminder sent",
  attendance_adjusted: "Clock time adjusted",
};

export function activityKindLabel(kind: string | null | undefined): string {
  const key = (kind ?? "").trim().toLowerCase();
  if (KIND_LABEL[key]) return KIND_LABEL[key];
  if (!key) return "Activity";
  const words = key.replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Kyle C." / the email's local part / "Spark" for system-driven entries. */
export function activityActor(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const n = (name ?? "").trim();
  if (n) return n;
  const e = (email ?? "").trim();
  if (e) return e.split("@")[0];
  return "Spark (automatic)";
}

export function activityWhen(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}
