export interface QuickPeekItem {
  uuid: string;
  id: string;
  reqLabel: string;
  venue: string;
  market?: string | null;
  address?: string | null;
  dateLabel: string;
  timeLabel?: string | null;
  statusLabel: string;
  statusSlug: string;
  type?: string | null;
  skus?: readonly string[];
  requester?: string | null;
  staffingSummary?: string | null;
  recapSummary?: string | null;
  statusNote?: string | null;
  fullHref: string;
  editHref?: string | null;
  canApprove?: boolean;
  isApprovedOptimistic?: boolean;
}

export type QuickPeekKeyAction =
  | "next"
  | "prev"
  | "approve"
  | "decline"
  | "open_full"
  | null;

export function stepQuickPeekIndex(
  currentIndex: number,
  total: number,
  delta: 1 | -1,
): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return 0;
  return Math.max(0, Math.min(total - 1, currentIndex + delta));
}

export function resolveQuickPeekKeyAction(
  key: string,
  opts?: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
): QuickPeekKeyAction {
  if (opts?.metaKey || opts?.ctrlKey || opts?.altKey) return null;
  switch (key) {
    case "j":
    case "ArrowDown":
      return "next";
    case "k":
    case "ArrowUp":
      return "prev";
    case "a":
    case "A":
      return "approve";
    case "d":
    case "D":
      return "decline";
    case "Enter":
      return "open_full";
    default:
      return null;
  }
}
