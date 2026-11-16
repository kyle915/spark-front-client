import { describe, expect, it } from "vitest";
import {
  anyLookedAt,
  nextChoice,
  pickCount,
  picksFirst,
  statusLine,
  type PhotoPick,
} from "./bestPhotos";

const photo = (over: Partial<PhotoPick> = {}): PhotoPick => ({
  fileId: "1",
  url: "https://storage.googleapis.com/b/recap_files/a.jpg",
  category: "Table Set Up",
  status: "scored",
  note: "",
  score: 82,
  caption: "Sampling table at the store entrance",
  modelPick: true,
  staffChoice: "",
  isPick: true,
  canPick: true,
  ...over,
});

describe("best photos", () => {
  it("offers the opposite of the current state", () => {
    expect(nextChoice(photo({ isPick: true }))).toBe("unpinned");
    expect(nextChoice(photo({ isPick: false }))).toBe("pinned");
  });

  it("says why a photo is or is not a best photo", () => {
    expect(statusLine(photo())).toBe("Score 82 of 100");
    expect(statusLine(photo({ staffChoice: "pinned" }))).toBe("Pinned by staff");
    expect(statusLine(photo({ staffChoice: "unpinned", isPick: false }))).toBe("Unpinned by staff");
    expect(statusLine(photo({ status: "not_scored", score: null, isPick: false }))).toBe(
      "Not scored yet",
    );
    expect(
      statusLine(photo({ status: "skipped", score: null, note: "Too small to print well" })),
    ).toBe("Too small to print well");
    expect(statusLine(photo({ canPick: false, note: "Receipt", staffChoice: "pinned" }))).toBe(
      "Receipt",
    );
  });

  it("counts picks and puts them first", () => {
    const items = [
      photo({ fileId: "1", isPick: false }),
      photo({ fileId: "2", isPick: true }),
      photo({ fileId: "3", isPick: false }),
      photo({ fileId: "4", isPick: true }),
    ];
    expect(pickCount(items)).toBe(2);
    expect(picksFirst(items).map((i) => i.fileId)).toEqual(["2", "4", "1", "3"]);
  });

  it("knows when nothing has been scored yet", () => {
    expect(anyLookedAt([photo({ status: "not_scored" })])).toBe(false);
    expect(anyLookedAt([photo({ status: "not_scored" }), photo({ status: "skipped" })])).toBe(true);
  });
});
