export type RecapQuickPeekAction =
  | "next"
  | "prev"
  | "approve"
  | "share"
  | "open_full";

export function resolveRecapQuickPeekKey(input: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  isTypingTarget?: boolean;
  canApprove: boolean;
  canShare: boolean;
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
    case "a":
    case "A":
      return input.canApprove ? "approve" : null;
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
