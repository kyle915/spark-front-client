/**
 * Tell staff when something fails for an ambassador on the check-in page.
 *
 * The page already works around most failures (queues, retries), which is
 * exactly why nobody at the office heard about them. This sends a tiny,
 * anonymous note — a kind and a short detail, never a name or number — so a
 * lead can see "photo uploads are failing at this store today".
 *
 * Strictly fire-and-forget: it must never slow the ambassador down, throw,
 * or queue. If it can't be sent (no signal — often the very reason for the
 * failure) it is simply dropped.
 */
export type FieldIssueKind =
  | "photo_upload_failed"
  | "gps_denied"
  | "gps_timeout"
  | "request_timeout"
  | "punch_not_saved"
  | "storage_unavailable"
  | "recap_submit_failed";

/** Same kind + detail is reported at most once per page life. */
const sent = new Set<string>();

export const fieldIssueBody = (
  kind: FieldIssueKind,
  detail: string,
  session?: string | null,
): string =>
  JSON.stringify({
    kind,
    // Collapse whitespace and cap: this is a hint, not a log.
    detail: detail.replace(/\s+/g, " ").trim().slice(0, 200),
    ...(session ? { session } : {}),
  });

export function reportFieldIssue(opts: {
  origin: string;
  code: string;
  kind: FieldIssueKind;
  detail?: string;
  session?: string | null;
}): void {
  try {
    if (!opts.origin || !opts.code) return;
    const detail = opts.detail ?? "";
    const key = `${opts.code}|${opts.kind}|${detail}`;
    if (sent.has(key)) return;
    sent.add(key);
    const url = `${opts.origin}/api/public/checkin/${encodeURIComponent(opts.code)}/client-event`;
    const body = fieldIssueBody(opts.kind, detail, opts.session);
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* dropped — reporting is best-effort */
    });
  } catch {
    /* never let reporting become a second problem */
  }
}

/** For tests. */
export const __resetFieldIssues = (): void => sent.clear();
