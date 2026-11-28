import React from "react";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import type { MobileDockKey } from "./mobileDockItems";

export const MobileDockBadgeDot: React.FC<{
  dockKey: MobileDockKey;
  isClient: boolean;
}> = ({ dockKey, isClient }) => {
  const counts = useSidebarCounts();
  let count = 0;
  if (dockKey === "home") {
    count = isClient
      ? counts.approvals
      : counts.approvals + counts.pendingWalkups;
  } else if (dockKey === "recaps") {
    count = isClient ? 0 : counts.recapsNeedsReview + counts.recapsDue;
  }
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} pending`}
      className="absolute top-1.5 right-[calc(50%-14px)] w-2 h-2 rounded-full"
      style={{
        background: "var(--spark-orange)",
        boxShadow: "0 0 0 2px var(--spark-surface)",
      }}
    />
  );
};

export default MobileDockBadgeDot;
