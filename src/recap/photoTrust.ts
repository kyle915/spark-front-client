type Check = {
  readonly code: string;
  readonly status: string;
  readonly detail?: string | null;
};

/**
 * The one line a client sees about photo checks, or null.
 *
 * Only a PASS of the duplicate-photo check produces a line. A flag, a check
 * that did not apply (no photos) or a missing check all return null, so a
 * client is never shown a warning meant for staff, and never shown
 * "verified" for a recap that was not actually checked.
 */
export const photoTrustLine = (
  checks: ReadonlyArray<Check | null | undefined> | null | undefined,
): string | null => {
  const dup = (checks ?? []).find((c) => c?.code === "duplicate_photos");
  if (!dup || dup.status !== "pass") return null;
  const count = /(\d+)\s+photos?/i.exec(dup.detail ?? "")?.[1];
  return count
    ? `${count} photo${count === "1" ? "" : "s"} checked by Spark — each one is a unique image.`
    : "Photos checked by Spark — each one is a unique image.";
};
