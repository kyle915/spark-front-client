export type RecapQuickPeekAction =
  | "next"
  | "prev"
  | "approve"
  | "approve_and_next"
  | "share"
  | "open_full"
  | "photo_prev"
  | "photo_next";

export function resolveRecapQuickPeekKey(input: {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  isTypingTarget?: boolean;
  canApprove: boolean;
  canShare: boolean;
  hasMultiplePhotos?: boolean;
}): RecapQuickPeekAction | null {
  if (input.isTypingTarget || input.metaKey || input.ctrlKey || input.altKey) {
    return null;
  }
  switch (input.key) {
    case "j":
    case "ArrowDown":
      return "next";
    case "k":
    case "ArrowUp":
      return "prev";
    case "ArrowLeft":
      return input.hasMultiplePhotos ? "photo_prev" : null;
    case "ArrowRight":
      return input.hasMultiplePhotos ? "photo_next" : null;
    case "a":
    case "A":
      if (!input.canApprove) return null;
      return input.shiftKey ? "approve_and_next" : "approve";
    case "s":
    case "S":
      return input.canShare ? "share" : null;
    case "Enter":
      return "open_full";
    default:
      return null;
  }
}

export function buildPublicRecapShareUrl(
  origin: string,
  shareToken: string | null | undefined,
): string | null {
  const token = (shareToken ?? "").trim();
  if (!token) return null;
  const base = origin.replace(/\/+$/, "");
  return `${base}/r/${encodeURIComponent(token)}`;
}
