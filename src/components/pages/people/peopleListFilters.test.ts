import { describe, expect, it } from "vitest";
import {
  PEOPLE_PAGE_SIZE,
  peopleSearchIsActive,
  peopleServerFilters,
} from "./peopleListFilters";

describe("peopleServerFilters", () => {
  it("keeps a page inside the server cap", () => {
    expect(PEOPLE_PAGE_SIZE).toBeLessThanOrEqual(100);
    expect(PEOPLE_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("sends name, email, and role so people past the page can be found", () => {
    expect(
      peopleServerFilters({
        tenantId: "t1",
        search: "Kyle Christiansen",
        role: "ambassador",
      }),
    ).toEqual({
      tenantId: "t1",
      name: "Christiansen",
      role: "AMBASSADOR",
    });
    expect(
      peopleServerFilters({
        tenantId: "t1",
        search: "ada@igniteproductions.co",
        role: "all",
      }),
    ).toEqual({
      tenantId: "t1",
      email: "ada@igniteproductions.co",
    });
    expect(
      peopleServerFilters({
        tenantId: "t1",
        search: "",
        role: "spark-admin",
      }),
    ).toEqual({ tenantId: "t1", role: "SPARK" });
  });

  it("does not invent a client-name filter", () => {
    const filters = peopleServerFilters({
      tenantId: null,
      search: "Brew",
      role: "client",
    });
    expect(filters).toEqual({ name: "Brew", role: "CLIENT" });
    expect(filters).not.toHaveProperty("clientName");
  });

  it("treats an empty search and Everyone as not a search", () => {
    expect(peopleSearchIsActive("", "all")).toBe(false);
    expect(peopleSearchIsActive("ada", "all")).toBe(true);
    expect(peopleSearchIsActive("", "client")).toBe(true);
  });
});
