/**
 * The walk-up program picker ("Event / Guerilla / Seeding / Retail") is a
 * required first step on multi-program links. BAs fill the store and date,
 * tap Start, and miss an error printed far below a picker that has scrolled
 * off-screen — so the button, the bottom error and the picker itself all
 * point at what's missing.
 */
import {
  eventTypeIsActivation,
  eventTypeIsRetailSampling,
  programLabel,
  type ProgramOption,
} from "./eventTypeDescriptor";

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
  /** Forgotten past-day path — same verb as recap-only (no clock). */
  pastRecap?: boolean;
}): string {
  if (opts.busy) return "Starting…";
  const toRecap = opts.recapOnly || Boolean(opts.pastRecap);
  if (opts.needsProgram) {
    return toRecap ? "Select event type to continue" : "Select event type to start";
  }
  return toRecap ? "Continue to recap" : "Start check-in";
}

/**
 * How the identify step asks "where": a venue for Event / Guerilla
 * activations, typed store name + address on a no-clock link (agency, or the
 * client-team link's Retail), else the usual store picker.
 */
export type IdentifyPlaceKind = "venue" | "typedStore" | "store";

export function identifyPlaceKind(opts: {
  recapOnly: boolean;
  programName?: string | null;
}): IdentifyPlaceKind {
  if (eventTypeIsActivation(opts.programName)) return "venue";
  return opts.recapOnly ? "typedStore" : "store";
}

/** Same words as the API's error, so the BA reads one message either way. */
export const STORE_NAME_REQUIRED_ERROR =
  "Enter the store name so your work counts for the right store.";

/**
 * Must the BA name the store before starting? Retail sampling only: the picked
 * program's own flag (or its name), else the link's default program when the
 * link offers no picker. With a picker and nothing picked yet, the program
 * question comes first.
 */
export function storeNameRequired(opts: {
  program?: Pick<ProgramOption, "name" | "storeNameRequired"> | null;
  linkDefault?: boolean;
  hasPrograms: boolean;
}): boolean {
  if (opts.program) {
    return opts.program.storeNameRequired ?? eventTypeIsRetailSampling(opts.program.name);
  }
  return !opts.hasPrograms && Boolean(opts.linkDefault);
}

/** Subtitle under "File a recap" on a no-clock standing link. */
export function recapOnlyIntro(opts: { hasPrograms: boolean }): string {
  return opts.hasPrograms
    ? "Your name, the event type, then the recap questions."
    : "Date, your name, the store, then the recap questions.";
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
