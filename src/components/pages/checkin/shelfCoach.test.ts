import { describe, expect, it } from "vitest";
import {
  SHELF_COACH_UNAVAILABLE,
  advisoryFromShelfCoach,
  mergePhotoAdvisories,
  requestShelfCoach,
  type ShelfCoachResult,
} from "./shelfCoach";

const base: ShelfCoachResult = {
  available: true,
  reason: "",
  status: "read",
  answers: {
    productOnShelf: "no",
    facings: null,
    priceTagVisible: "no",
    price: null,
    outOfStockGap: "unclear",
  },
  nudges: [
    {
      code: "product_missing",
      severity: "warn",
      message: "Product doesn't appear on the shelf.",
    },
  ],
  message: "Product doesn't appear on the shelf.",
  persisted: false,
};

describe("shelf coach advisory", () => {
  it("warns when a nudge is present", () => {
    const advisory = advisoryFromShelfCoach(base);
    expect(advisory.kind).toBe("warn");
    expect(advisory.message).toContain("shelf");
  });

  it("says unavailable when the model cannot run", () => {
    expect(
      advisoryFromShelfCoach({
        ...base,
        available: false,
        reason: SHELF_COACH_UNAVAILABLE,
        nudges: [],
        message: SHELF_COACH_UNAVAILABLE,
      }),
    ).toEqual({ kind: "unavailable", message: SHELF_COACH_UNAVAILABLE });
  });

  it("prefers shelf warn over photo-check ok", () => {
    const merged = mergePhotoAdvisories(
      { kind: "ok", message: "Looks like shelf." },
      { kind: "warn", message: "No price tag." },
    );
    expect(merged).toEqual({ kind: "warn", message: "No price tag." });
  });

  it("degrades when the coach request fails", async () => {
    const result = await requestShelfCoach({
      origin: "https://api.test",
      code: "BD-AQRACD",
      session: "tok",
      file: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
      contentType: "image/jpeg",
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    expect(result.available).toBe(false);
    expect(result.message).toBe(SHELF_COACH_UNAVAILABLE);
  });
});
