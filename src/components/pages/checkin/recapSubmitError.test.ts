import { describe, expect, it } from "vitest";
import { recapSubmitErrorMessage } from "./recapSubmitError";

describe("recapSubmitErrorMessage", () => {
  it("uses the API sentence when the server already said why", () => {
    expect(
      recapSubmitErrorMessage({ message: "Add at least one photo of your event." }, 400),
    ).toBe("Add at least one photo of your event.");
  });

  it("explains an expired session in standing-link language", () => {
    expect(recapSubmitErrorMessage({}, 401)).toBe(
      "Your check-in session expired. Start over and pick the date you worked.",
    );
  });

  it("does not hide a missing-photo refusal behind a generic failure", () => {
    expect(recapSubmitErrorMessage(null, 400)).toMatch(/photo/i);
  });
});
