/**
 * Pure threshold math for SwipeToConfirm (kept separate from ConfirmGestures.tsx
 * for React Fast Refresh compatibility and clean unit testing).
 */
export function swipeProgressFromDelta(
  deltaPx: number,
  maxTravelPx: number,
): number {
  if (maxTravelPx <= 0) return 0;
  return Math.max(0, Math.min(1, deltaPx / maxTravelPx));
}

export const SWIPE_COMMIT_THRESHOLD = 0.82;
