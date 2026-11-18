/** Staff-facing label for how a BA's product question was answered. */
export function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "answered":
      return "Answered";
    case "not_in_notes":
      return "Not in the notes — add it";
    case "no_material":
      return "No product info yet";
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

export type SourceRow = {
  kind: string;
  status: string;
  error: string;
  excluded: boolean;
};

/** Short staff-facing status for one website page or document. */
export function sourceStatus(row: SourceRow): string {
  if (row.excluded) return "Excluded from answers";
  if (row.status === "empty") return "No readable text";
  if (row.status === "error" || row.error) {
    const why: Record<string, string> = {
      timeout: "timed out",
      "too-large": "file too large",
      "file-not-found": "file not found",
      "off-domain": "moved off the brand's site",
      "blocked-host": "address not allowed",
      "brand-text-cap-reached": "brand text limit reached",
    };
    const reason = why[row.error] ?? (row.error.startsWith("http-") ? `error ${row.error.slice(5)}` : "");
    return reason ? `Couldn't read — ${reason}` : "Couldn't read";
  }
  return "";
}

/** "Website: 12 pages, 30 products · refreshed 2 h ago". */
export function sourcesSummary(
  label: string,
  parts: Array<[number, string, string]>,
  refreshedAt: string,
  now: Date = new Date(),
): string {
  const counts = parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n.toLocaleString()} ${n === 1 ? one : many}`);
  const when = askedWhen(refreshedAt, now);
  return [
    `${label}: ${counts.length ? counts.join(", ") : "nothing yet"}`,
    when ? `refreshed ${when}` : "not refreshed yet",
  ].join(" · ");
}

/** Website rows first (homepage, then by address), then documents by title. */
export function sortSources<T extends { kind: string; label: string; title: string }>(rows: readonly T[]): T[] {
  const isWeb = (k: string) => k === "website_page" || k === "shopify_product";
  return [...rows].sort((a, b) => {
    if (isWeb(a.kind) !== isWeb(b.kind)) return isWeb(a.kind) ? -1 : 1;
    const ka = isWeb(a.kind) ? a.label : a.title;
    const kb = isWeb(b.kind) ? b.label : b.title;
    return ka.length - kb.length || ka.localeCompare(kb);
  });
}
