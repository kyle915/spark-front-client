import { describe, expect, it, vi } from "vitest";
import {
  identifyPlaceKind,
  identifySubmitLabel,
  programChoiceList,
  programPickerPrompt,
  programRequiredHint,
  recapOnlyIntro,
  revealProgramPicker,
} from "./programPickerGate";

const torch = [
  { name: "Event Activation", label: "Event" },
  { name: "Guerilla Activation", label: "Guerilla" },
  { name: "Product Seeding", label: "Seeding" },
  { name: "Retail Sampling", label: "Retail" },
];
const liquidDeath = [
  { name: "Retail Sampling", label: "" },
  { name: "Event Activation", label: "" },
  { name: "Product Seeding", label: "" },
];

describe("program picker prompt", () => {
  it("lists the link's own options, brand labels first", () => {
    expect(programChoiceList(torch)).toBe("Event, Guerilla, Seeding or Retail");
    expect(programPickerPrompt(torch)).toBe(
      "Choose Event, Guerilla, Seeding or Retail to clock in",
    );
  });

  it("falls back to event type names when a brand has no labels", () => {
    expect(programPickerPrompt(liquidDeath)).toBe(
      "Choose Retail Sampling, Event Activation or Product Seeding to clock in",
    );
  });

  it("joins two options with 'or' and says recap on recap-only links", () => {
    expect(programChoiceList(torch.slice(0, 2))).toBe("Event or Guerilla");
    expect(programPickerPrompt(torch.slice(0, 2), { recapOnly: true })).toBe(
      "Choose Event or Guerilla to file your recap",
    );
    expect(programRequiredHint({ recapOnly: true })).toBe("Required to file your recap.");
    expect(programRequiredHint()).toBe("Required to clock in.");
  });
});

describe("identify submit label", () => {
  it("asks for the event type until one is picked", () => {
    expect(identifySubmitLabel({ busy: false, recapOnly: false, needsProgram: true })).toBe(
      "Select event type to start",
    );
    expect(identifySubmitLabel({ busy: false, recapOnly: true, needsProgram: true })).toBe(
      "Select event type to continue",
    );
  });

  it("reads Start check-in once picked (or when the link has one program)", () => {
    expect(identifySubmitLabel({ busy: false, recapOnly: false, needsProgram: false })).toBe(
      "Start check-in",
    );
    expect(identifySubmitLabel({ busy: false, recapOnly: true, needsProgram: false })).toBe(
      "Continue to recap",
    );
    expect(identifySubmitLabel({ busy: true, recapOnly: false, needsProgram: false })).toBe(
      "Starting…",
    );
  });

  it("uses Continue to recap on the forgotten past-day path", () => {
    expect(
      identifySubmitLabel({ busy: false, recapOnly: false, needsProgram: false, pastRecap: true }),
    ).toBe("Continue to recap");
    expect(
      identifySubmitLabel({ busy: false, recapOnly: false, needsProgram: true, pastRecap: true }),
    ).toBe("Select event type to continue");
  });
});

describe("identify place step", () => {
  it("asks for a venue on Event / Guerilla, clock link or not", () => {
    for (const recapOnly of [false, true]) {
      expect(identifyPlaceKind({ recapOnly, programName: "Event Activation" })).toBe("venue");
      expect(identifyPlaceKind({ recapOnly, programName: "Guerilla Activation" })).toBe("venue");
    }
  });

  it("keeps the typed store on no-clock Retail and the agency link (no picker)", () => {
    expect(identifyPlaceKind({ recapOnly: true, programName: "Retail Sampling" })).toBe("typedStore");
    expect(identifyPlaceKind({ recapOnly: true })).toBe("typedStore");
    expect(identifyPlaceKind({ recapOnly: false, programName: "Retail Sampling" })).toBe("store");
    expect(identifyPlaceKind({ recapOnly: false })).toBe("store");
  });

  it("tells a client-team filer the event type comes before the recap", () => {
    expect(recapOnlyIntro({ hasPrograms: true })).toBe(
      "Your name, the event type, then the recap questions.",
    );
    expect(recapOnlyIntro({ hasPrograms: false })).toBe(
      "Date, your name, the store, then the recap questions.",
    );
  });
});

describe("revealProgramPicker", () => {
  it("smooth-scrolls the picker to center, then focuses without a jump", () => {
    const calls: string[] = [];
    const el = {
      scrollIntoView: vi.fn(() => calls.push("scroll")),
      focus: vi.fn(() => calls.push("focus")),
    };
    revealProgramPicker(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(el.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(calls).toEqual(["scroll", "focus"]);
  });

  it("skips the animation for reduced motion and tolerates a missing node", () => {
    const el = { scrollIntoView: vi.fn(), focus: vi.fn() };
    revealProgramPicker(el, { reduceMotion: true });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    expect(() => revealProgramPicker(null)).not.toThrow();
  });
});
