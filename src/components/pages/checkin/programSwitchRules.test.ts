import { describe, expect, it } from "vitest";

import type { DraftPhoto } from "./photoDraft";
import {
  buildChangeProgramBody,
  currentProgramLabel,
  otherPrograms,
  remapDraftPhotos,
  showProgramSwitch,
  switchConfirmCopy,
  switchResultCopy,
} from "./programSwitchRules";

const PROGRAMS = [
  { id: "1", name: "Retail Sampling", label: "Retail", storeNameRequired: true },
  { id: "2", name: "G7 Guerilla Sampling" },
];

const base = {
  programs: PROGRAMS,
  currentId: "2",
  hasRecap: false,
  timesheetOnly: false,
  recapQueued: false,
  leftover: false,
};

describe("showProgramSwitch", () => {
  it("shows on a multi-program link before the recap is filed", () => {
    expect(showProgramSwitch(base)).toBe(true);
  });

  it("hides when there is nothing to switch to", () => {
    expect(showProgramSwitch({ ...base, programs: [PROGRAMS[0]] })).toBe(false);
    expect(showProgramSwitch({ ...base, programs: undefined })).toBe(false);
    expect(showProgramSwitch({ ...base, currentId: null })).toBe(false);
  });

  it("hides once the recap is in, on a time clock, on a prior day, or with a recap waiting to send", () => {
    expect(showProgramSwitch({ ...base, hasRecap: true })).toBe(false);
    expect(showProgramSwitch({ ...base, timesheetOnly: true })).toBe(false);
    expect(showProgramSwitch({ ...base, leftover: true })).toBe(false);
    expect(showProgramSwitch({ ...base, recapQueued: true })).toBe(false);
  });
});

describe("labels and copy", () => {
  it("lists every program but the current one", () => {
    expect(otherPrograms(PROGRAMS, "2").map((p) => p.id)).toEqual(["1"]);
  });

  it("names the current program the way the picker did", () => {
    expect(currentProgramLabel(PROGRAMS, { id: "1", name: "Retail Sampling" })).toBe("Retail");
    expect(currentProgramLabel(PROGRAMS, { id: "9", name: "Old Program" })).toBe("Old Program");
  });

  it("asks plainly before switching", () => {
    expect(switchConfirmCopy({ name: "Retail Sampling" })).toBe(
      "Switch to Retail Sampling? You'll answer the Retail Sampling recap instead. Your clock-in stays.",
    );
  });

  it("says what carried over", () => {
    expect(
      switchResultCopy(
        { from: "A", to: "B", carried: 3, dropped: ["x", "y"], photos: 4, photosMoved: 1 },
        "Retail Sampling",
      ),
    ).toBe(
      "Switched to Retail Sampling. 3 answers carried over. 2 answers aren't on the new form, so they were cleared. 1 photo moved to Other photos.",
    );
    expect(
      switchResultCopy(
        { from: "A", to: "B", carried: 0, dropped: [], photos: 0, photosMoved: 0 },
        "Retail",
      ),
    ).toBe("Switched to Retail.");
  });
});

describe("remapDraftPhotos", () => {
  const photo = (id: string, category: string | null): DraftPhoto => ({
    id,
    blobName: null,
    category,
    name: `${id}.jpg`,
    type: "image/jpeg",
  });

  it("keeps every photo and moves ones without a bucket to the generic pile", () => {
    const out = remapDraftPhotos(
      [photo("a", "crowd"), photo("b", "setup"), photo("c", null)],
      null,
      [{ id: "setup", name: "Setup", helper: "", min: 0 }],
    );
    expect(out.map((p) => [p.id, p.category])).toEqual([
      ["a", null],
      ["b", "setup"],
      ["c", null],
    ]);
  });

  it("follows the server's carried category when it knows the photo", () => {
    const out = remapDraftPhotos(
      [photo("a", "crowd")],
      {
        v: 1,
        savedAt: 1,
        values: {},
        samples: {},
        engagements: "",
        photos: [{ ...photo("a", "shelf") }],
      },
      [{ id: "shelf", name: "Shelf", helper: "", min: 0 }],
    );
    expect(out[0].category).toBe("shelf");
  });
});

describe("buildChangeProgramBody", () => {
  it("sends the store name only when typed", () => {
    expect(buildChangeProgramBody({ session: "t", eventTypeId: "1", storeName: "  " })).toEqual({
      session: "t",
      eventTypeId: "1",
    });
    expect(
      buildChangeProgramBody({ session: "t", eventTypeId: "1", storeName: " Kroger " }),
    ).toMatchObject({ storeName: "Kroger" });
  });
});
