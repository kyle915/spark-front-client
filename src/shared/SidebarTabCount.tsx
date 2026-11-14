import { Suspense } from "react";
import useSidebarCounts, { type SidebarCounts } from "@/hooks/useSidebarCounts";

/**
 * The number of things waiting behind a tab, printed after its label.
 *
 * Reads the same server counts as the sidebar badges (already in the Relay
 * store on any page with the sidebar), so a tab and its sidebar badge can
 * never disagree. Shows nothing at zero or while loading — a tab with no
 * work behind it carries no number.
 */
type CountKey = "pendingWalkups" | "recapsNeedsReview";

const Inner: React.FC<{ pick: CountKey }> = ({ pick }) => {
  const counts: SidebarCounts = useSidebarCounts();
  const n = counts[pick];
  if (!n || n <= 0) return null;
  return (
    <span className="spark-tab-count" aria-label={`${n} waiting`}>
      {n.toLocaleString()}
    </span>
  );
};

export const SidebarTabCount: React.FC<{ pick: CountKey }> = ({ pick }) => (
  <Suspense fallback={null}>
    <Inner pick={pick} />
  </Suspense>
);

export default SidebarTabCount;
