export const PRESENT_ATTR = "data-spark-present";
export const PRESENT_EVENT = "spark:present-change";

export function isPresentModeActive(
  doc: Document | undefined = typeof document !== "undefined"
    ? document
    : undefined,
): boolean {
  if (!doc) return false;
  return doc.documentElement.getAttribute(PRESENT_ATTR) === "true";
}

export function setPresentMode(
  active: boolean,
  doc: Document | undefined = typeof document !== "undefined"
    ? document
    : undefined,
): boolean {
  if (!doc) return active;
  if (active) {
    doc.documentElement.setAttribute(PRESENT_ATTR, "true");
  } else {
    doc.documentElement.removeAttribute(PRESENT_ATTR);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRESENT_EVENT));
  }
  return active;
}

export function togglePresentMode(
  doc: Document | undefined = typeof document !== "undefined"
    ? document
    : undefined,
): boolean {
  const next = !isPresentModeActive(doc);
  return setPresentMode(next, doc);
}

export function resolvePresentModeKey(input: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  isPresent: boolean;
  isTypingTarget?: boolean;
}): "toggle" | "exit" | null {
  if (
    (input.metaKey || input.ctrlKey) &&
    input.shiftKey &&
    input.key.toLowerCase() === "p"
  ) {
    return "toggle";
  }
  if (input.isPresent && input.key === "Escape" && !input.isTypingTarget) {
    return "exit";
  }
  return null;
}
