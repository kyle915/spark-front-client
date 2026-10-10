import { describe, expect, it } from "vitest";
import { planErrorMessage } from "./fieldMarketingGql";

describe("planErrorMessage", () => {
  it("keeps plan validation messages as written", () => {
    expect(planErrorMessage("Pick at least one SKU.")).toBe("Pick at least one SKU.");
    expect(planErrorMessage("Name the event.")).toBe("Name the event.");
  });

  it("names access problems instead of showing raw server text", () => {
    expect(planErrorMessage("It looks like you are not a member of this tenant.")).toMatch(
      /isn't linked to Torch THC/,
    );
    expect(planErrorMessage("get() returned more than one TenantedUser -- it returned 2!")).toMatch(
      /isn't linked to Torch THC/,
    );
    expect(planErrorMessage("Field marketing is for the brand team.")).toMatch(
      /brand ambassador account/,
    );
  });

  it("tells an expired session and a dropped connection apart", () => {
    expect(planErrorMessage("Authentication required.")).toMatch(/sign-in expired/);
    expect(planErrorMessage("network")).toMatch(/Couldn't reach Spark/);
    expect(planErrorMessage("")).toMatch(/couldn't save/);
  });
});
