import type { Page } from "@playwright/test";
import {
  DARK_CANVAS_FALLBACK,
  LIGHT_CANVAS_FALLBACK,
  evaluateElementContrast,
  type ElementContrastEvaluation,
} from "../../src/theme/wcagContrast";

export interface RawAuditedElement {
  tagName: string;
  role: string | null;
  text: string;
  selectorHint: string;
  foreground: string;
  backgroundLayers: Array<{ color: string; opacity: number }>;
  fontSizePx: number;
  fontWeight: number;
  effectiveOpacity: number;
  isDisabled: boolean;
}

export interface ContrastViolation {
  element: RawAuditedElement;
  evaluation: ElementContrastEvaluation;
}

export interface PageAuditReport {
  route: string;
  mode: "light" | "dark";
  viewport: string;
  checkedElements: number;
  contrastViolations: ContrastViolation[];
  horizontalOverflowPx: number;
  scrollWidth: number;
  innerWidth: number;
}

const INTERACTIVE_AND_LABEL_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='menuitem']",
  "[role='tab']",
  ".chip",
  ".pill-btn",
  ".nav-badge",
  ".recap-doc-badge",
  "[data-testid='workspace-single-pill']",
  "span.rounded-full",
  "span[class*='badge']",
  "label",
].join(", ");

/**
 * Audit all visible interactive buttons, badges, pills, links, labels, and
 * form inputs on the current page against WCAG 2.1 AA contrast, the
 * light-surface neon-lime guardrail, and horizontal viewport overflow.
 */
export async function auditPage(
  page: Page,
  context: {
    route: string;
    mode: "light" | "dark";
    viewport: string;
  },
): Promise<PageAuditReport> {
  const { elements, scrollWidth, innerWidth } = await page.evaluate(
    (selector: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const normalizeColorString = (cssColor: string): string => {
        if (!cssColor || cssColor === "transparent") return "rgba(0, 0, 0, 0)";
        if (
          cssColor.startsWith("rgb(") ||
          cssColor.startsWith("rgba(") ||
          cssColor.startsWith("#")
        ) {
          return cssColor;
        }
        // Fallback through 2D canvas so any exotic color-mix() / display-p3
        // computed color resolves accurately to sRGB bytes.
        if (!ctx) return cssColor;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        const alpha = Number((data[3] / 255).toFixed(4));
        return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${alpha})`;
      };

      const isHiddenOrClipped = (el: HTMLElement): boolean => {
        if (el.getAttribute("aria-hidden") === "true") return true;
        let cur: HTMLElement | null = el;
        while (cur) {
          const style = window.getComputedStyle(cur);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number.parseFloat(style.opacity) <= 0.01
          ) {
            return true;
          }
          // Skip screen-reader-only visually hidden helpers (.sr-only)
          if (
            style.position === "absolute" &&
            style.overflow === "hidden" &&
            (cur.offsetWidth <= 1 || cur.offsetHeight <= 1)
          ) {
            return true;
          }
          cur = cur.parentElement;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return true;
        // Skip elements parked entirely off-screen (e.g. collapsed mobile drawer)
        if (
          rect.right <= 0 ||
          rect.left >= window.innerWidth ||
          rect.bottom <= 0
        ) {
          return true;
        }
        return false;
      };

      const hasDirectReadableText = (el: HTMLElement): string => {
        const tag = el.tagName.toLowerCase();
        if (tag === "input") {
          const input = el as HTMLInputElement;
          if (
            input.type === "checkbox" ||
            input.type === "radio" ||
            input.type === "hidden" ||
            input.type === "file"
          ) {
            return "";
          }
          return (input.value || "").trim();
        }
        if (tag === "textarea") {
          return ((el as HTMLTextAreaElement).value || "").trim();
        }
        if (tag === "select") {
          const sel = el as HTMLSelectElement;
          const opt = sel.options[sel.selectedIndex];
          return (opt?.textContent || sel.value || "").trim();
        }

        // For label containers that only wrap an input + inner <span>, audit
        // the inner text nodes only when the label itself owns direct text
        // (avoids attributing a child's dark color to a wrapper label or vice versa).
        if (tag === "label") {
          const directText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? "")
            .join(" ")
            .trim();
          return directText;
        }

        // For buttons/links/chips/badges, collect visible text (excluding sr-only)
        const text = (el.innerText || "").replace(/\s+/g, " ").trim();
        return text;
      };

      const buildHint = (el: HTMLElement): string => {
        const tag = el.tagName.toLowerCase();
        const testId = el.getAttribute("data-testid");
        if (testId) return `${tag}[data-testid="${testId}"]`;
        const aria = el.getAttribute("aria-label");
        if (aria) return `${tag}[aria-label="${aria}"]`;
        const cls =
          typeof el.className === "string"
            ? el.className
                .trim()
                .split(/\s+/)
                .slice(0, 3)
                .join(".")
            : "";
        return cls ? `${tag}.${cls}` : tag;
      };

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      );
      const collected: RawAuditedElement[] = [];

      for (const el of nodes) {
        if (isHiddenOrClipped(el)) continue;

        const text = hasDirectReadableText(el);
        if (!text) continue;

        // If a button/link/label contains a nested styled span/p that sets a
        // DIFFERENT foreground color for ALL of its text, let the inner node
        // or the element itself represent the actual painted text accurately.
        const style = window.getComputedStyle(el);
        const fontSizePx = Number.parseFloat(style.fontSize) || 14;
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;

        // Walk ancestors to gather background layers + cumulative opacity
        const backgroundLayers: Array<{ color: string; opacity: number }> = [];
        let effectiveOpacity = 1;
        let cur: HTMLElement | null = el;
        while (cur) {
          const cs = window.getComputedStyle(cur);
          const op = Number.parseFloat(cs.opacity);
          const safeOp = Number.isNaN(op) ? 1 : op;
          effectiveOpacity *= safeOp;
          backgroundLayers.push({
            color: normalizeColorString(cs.backgroundColor),
            opacity: safeOp,
          });
          cur = cur.parentElement;
        }

        const isDisabled =
          (el as HTMLButtonElement).disabled === true ||
          el.getAttribute("aria-disabled") === "true" ||
          el.closest("[aria-disabled='true']") !== null;

        collected.push({
          tagName: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
          text: text.slice(0, 80),
          selectorHint: buildHint(el),
          foreground: normalizeColorString(style.color),
          backgroundLayers,
          fontSizePx,
          fontWeight,
          effectiveOpacity,
          isDisabled,
        });
      }

      return {
        elements: collected,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    },
    INTERACTIVE_AND_LABEL_SELECTOR,
  );

  const fallback =
    context.mode === "light" ? LIGHT_CANVAS_FALLBACK : DARK_CANVAS_FALLBACK;

  const contrastViolations: ContrastViolation[] = [];
  for (const el of elements) {
    const evaluation = evaluateElementContrast({
      foreground: el.foreground,
      backgroundLayers: el.backgroundLayers,
      fallbackBackground: fallback,
      fontSizePx: el.fontSizePx,
      fontWeight: el.fontWeight,
      effectiveOpacity: el.effectiveOpacity,
      isDisabled: el.isDisabled,
    });
    if (!evaluation.passes) {
      contrastViolations.push({ element: el, evaluation });
    }
  }

  return {
    route: context.route,
    mode: context.mode,
    viewport: context.viewport,
    checkedElements: elements.length,
    contrastViolations,
    horizontalOverflowPx: Math.max(0, scrollWidth - innerWidth),
    scrollWidth,
    innerWidth,
  };
}

export function formatViolationsReport(report: PageAuditReport): string {
  const lines = [
    `Audit failed on ${report.route} [${report.mode} · ${report.viewport}] (checked ${report.checkedElements} elements):`,
  ];
  if (report.horizontalOverflowPx > 1) {
    lines.push(
      `  - Horizontal overflow: scrollWidth=${report.scrollWidth}px > innerWidth=${report.innerWidth}px (+${report.horizontalOverflowPx}px)`,
    );
  }
  for (const v of report.contrastViolations) {
    lines.push(
      `  - <${v.element.selectorHint}> "${v.element.text}": ${v.evaluation.reasons.join("; ")}`,
    );
  }
  return lines.join("\n");
}
