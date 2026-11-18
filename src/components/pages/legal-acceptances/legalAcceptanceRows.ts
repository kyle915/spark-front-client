/** Pure helpers for the staff Legal acceptances page (kept apart for tests). */

export type AcceptanceRow = {
  userUuid: string;
  email: string;
  name: string;
  role: string;
  status: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  ipAddress: string;
  userAgent: string;
};

export const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  outdated: "Accepted an older version",
  never: "Not accepted",
};

export const ROLE_LABEL: Record<string, string> = {
  client: "Brand",
  "spark-admin": "Admin",
  // Gated only through staff access / an Ignite email.
  ambassador: "Ignite staff",
};

/** Not accepted first, then older versions, then accepted; by email inside. */
export function sortAcceptanceRows(rows: readonly AcceptanceRow[]): AcceptanceRow[] {
  const rank = (s: string) => (s === "never" ? 0 : s === "outdated" ? 1 : 2);
  return [...rows].sort(
    (a, b) => rank(a.status) - rank(b.status) || a.email.localeCompare(b.email)
  );
}

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function acceptanceRowsToCsv(rows: readonly AcceptanceRow[]): string {
  const head = ["Email", "Name", "Role", "Status", "Accepted version", "Accepted at (UTC)", "IP address", "User agent"];
  const lines = rows.map((r) =>
    [
      r.email,
      r.name,
      ROLE_LABEL[r.role] ?? r.role,
      STATUS_LABEL[r.status] ?? r.status,
      r.acceptedVersion ?? "",
      r.acceptedAt ?? "",
      r.ipAddress,
      r.userAgent,
    ]
      .map((v) => cell(String(v ?? "")))
      .join(",")
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}
