/**
 * The walk-up program picker ("Event / Guerilla / Seeding / Retail") is a
 * required first step on multi-program links. BAs fill the store and date,
 * tap Start, and miss an error printed far below a picker that has scrolled
 * off-screen — so the button, the bottom error and the picker itself all
 * point at what's missing.
 */
import { programLabel, type ProgramOption } from "./eventTypeDescriptor";

export const PROGRAM_STEP_TITLE = "Step 1 · Select your event type";

export const PROGRAM_MISSING_ERROR = "Select your event type above ↑";

/** "Event, Guerilla, Seeding or Retail" — the link's own options, in order. */
export function programChoiceList(
  eventTypes: ReadonlyArray<Pick<ProgramOption, "name" | "label">>,
): string {
  const labels = eventTypes.map(programLabel);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/** Inline message shown at the picker when Start is tapped without a pick. */
export function programPickerPrompt(
  eventTypes: ReadonlyArray<Pick<ProgramOption, "name" | "label">>,
  opts: { recapOnly?: boolean } = {},
): string {
  const action = opts.recapOnly ? "file your recap" : "clock in";
  return `Choose ${programChoiceList(eventTypes)} to ${action}`;
}

export function programRequiredHint(opts: { recapOnly?: boolean } = {}): string {
  return opts.recapOnly ? "Required to file your recap." : "Required to clock in.";
}

/** Label for the identify step's primary button. */
export function identifySubmitLabel(opts: {
  busy: boolean;
  recapOnly: boolean;
  needsProgram: boolean;
}): string {
  if (opts.busy) return "Starting…";
  if (opts.needsProgram) {
    return opts.recapOnly ? "Select event type to continue" : "Select event type to start";
  }
  return opts.recapOnly ? "Continue to recap" : "Start check-in";
}

type Revealable = {
  scrollIntoView: (arg: ScrollIntoViewOptions) => void;
  focus: (opts: FocusOptions) => void;
};

/**
 * Bring the picker back on screen and move focus to it. Focus waits on
 * `preventScroll` so it doesn't cut the smooth scroll short with a jump.
 */
export function revealProgramPicker(
  el: Revealable | null,
  opts: { reduceMotion?: boolean } = {},
): void {
  if (!el) return;
  el.scrollIntoView({ behavior: opts.reduceMotion ? "auto" : "smooth", block: "center" });
  el.focus({ preventScroll: true });
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
