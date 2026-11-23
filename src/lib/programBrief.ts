/**
 * Shaping for the program brief card. Pure functions over the stored
 * brief, so they are unit-tested without Relay. Nothing here invents a
 * number or calls a model.
 */

export type BriefTone = {
  status: string;
  isDraft: boolean;
  stale: boolean;
  autoReviewed: boolean;
  reviewedByName?: string | null;
};

/** One bullet per line, blank lines dropped, three at most. */
export function textToBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function bulletsToText(bullets: readonly string[]): string {
  return bullets
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** The line under the brief. Drafts and stale counts say the brand cannot see it. */
export function briefFooter(brief: BriefTone): string {
  if (brief.stale) {
    return "Approved recaps in these dates have changed. The brand does not see this until it is written again.";
  }
  if (brief.isDraft || brief.status !== "reviewed") {
    return "Draft. The brand does not see this until it is marked reviewed.";
  }
  if (brief.autoReviewed) {
    return "Written by AI from approved recaps. Every number was checked against this report.";
  }
  const who = brief.reviewedByName?.trim();
  return who
    ? `Written by AI from approved recaps and reviewed by ${who}.`
    : "Written by AI from approved recaps and reviewed by the Ignite team.";
}
