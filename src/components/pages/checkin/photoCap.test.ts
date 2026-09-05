import { describe, expect, it } from "vitest";
import { PHOTO_CAP } from "./photoCap";

describe("PHOTO_CAP", () => {
  it("allows Feel Free-sized field day batches", () => {
    expect(PHOTO_CAP).toBe(50);
  });
});
