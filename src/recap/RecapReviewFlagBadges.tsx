import { useSparkRole } from "@/hooks/useSparkRole";
import {
  reviewCheckTint,
  reviewFlagBadges,
  withoutStaffOnlyChecks,
  type ReviewFlagBadge,
  type ReviewFlagSummary,
} from "./reviewCheckDisplay";

/**
 * Compact orange advisory flag chips for Needs-review list rows.
 * GPS / Photos / Hours / Receipt / Dupes — never auto-approves.
 */
export function RecapReviewFlagBadges({
  flags,
  compact = false,
}: {
  flags: readonly ReviewFlagSummary[] | null | undefined;
  compact?: boolean;
}) {
  // BA confirmed / BA check badges are Ignite staff only.
  const { isAdmin, canToggleRole } = useSparkRole();
  const badges = reviewFlagBadges(
    withoutStaffOnlyChecks(flags, isAdmin && canToggleRole),
  );
  if (badges.length === 0) return null;
  const tint = reviewCheckTint("flag");
  return (
    <span
      className={`relative z-10 inline-flex items-center flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}
      aria-label={`${badges.length} review flag${badges.length === 1 ? "" : "s"}`}
    >
      {badges.map((badge: ReviewFlagBadge) => (
        <span
          key={badge.code}
          className={`mono font-bold whitespace-nowrap ${
            compact
              ? "text-[9px] px-1.5 py-0.5 rounded-full"
              : "text-[10px] px-2 py-1 rounded-full"
          }`}
          style={{
            letterSpacing: "0.08em",
            color: tint.color,
            background: tint.background,
            border: `1px solid ${tint.border}`,
          }}
          title={badge.label}
        >
          {badge.badge}
        </span>
      ))}
    </span>
  );
}

export default RecapReviewFlagBadges;
