export type ActionPhase = "idle" | "pending" | "success";

export type JumpOrigin = { x: number; y: number };

/** Shared spring for overlays / sheets / Jump — matches `--spark-spring`. */
export const SPARK_SPRING_EASE: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];
export const SPARK_SPRING_DURATION_S = 0.35;
export const SPARK_SPRING_CSS =
  "cubic-bezier(0.22, 1, 0.36, 1)";

export const ACTION_SUCCESS_HOLD_MS = 520;

export const ASK_AI_FOLLOWUPS = [
  "Missing recaps this week?",
  "Which BAs filed late?",
  "Which venues had zero samples?",
] as const;

export const RECAP_ASK_AI_FOLLOWUPS = [
  "What did shoppers say?",
  "Anything off in the photos?",
  "Which numbers were filed?",
] as const;

export const EVENT_ASK_AI_FOLLOWUPS = [
  "What did shoppers say?",
  "Anything off in the photos?",
  "What was filed on this event?",
] as const;

export type AskAiScope = "tenant" | "recap" | "event";

export function thoughtSeconds(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 1;
  return Math.max(1, Math.round(elapsedMs / 1000));
}

export function thoughtLabel(seconds: number): string {
  return `Thought for ${seconds}s`;
}

export function recapReviewStatus(approved: boolean): "Needs review" | "Approved" {
  return approved ? "Approved" : "Needs review";
}

export function holdActionSuccess(ms = ACTION_SUCCESS_HOLD_MS): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function jumpOriginFromElement(el: Element | null): JumpOrigin | null {
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function jumpOriginFromButton(): JumpOrigin | null {
  return jumpOriginFromElement(document.querySelector("[data-spark-jump]"));
}

export function jumpOriginFromEvent(e: Event): JumpOrigin | null {
  if (e instanceof CustomEvent) {
    const origin = e.detail?.origin as JumpOrigin | undefined;
    if (
      origin &&
      Number.isFinite(origin.x) &&
      Number.isFinite(origin.y)
    ) {
      return origin;
    }
  }
  return jumpOriginFromButton();
}

export function dispatchOpenJump(from?: EventTarget | null): void {
  const origin = jumpOriginFromElement(
    from instanceof Element ? from : document.querySelector("[data-spark-jump]"),
  );
  window.dispatchEvent(
    new CustomEvent("spark:open-jump", { detail: { origin } }),
  );
}

export function jumpOriginCss(origin: JumpOrigin | null): string {
  if (!origin || typeof window === "undefined") return "50% 16%";
  const x = (origin.x / window.innerWidth) * 100;
  const y = (origin.y / window.innerHeight) * 100;
  return `${x}% ${y}%`;
}
