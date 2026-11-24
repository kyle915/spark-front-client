import { describe, expect, it } from "vitest";
import { isActive, pickActivePath } from "./navActive";

const sections = [
  { items: [{ to: "/" , clientTo: "/client-dashboard" }, { to: "/plans" }] },
  { items: [{ to: "/settings" }, { to: "/settings/calendar" }, { to: "/calendar" }] },
];

describe("pickActivePath", () => {
  it("lights only the most specific item", () => {
    expect(pickActivePath(sections, "/settings/calendar", false)).toBe(
      "/settings/calendar",
    );
    expect(pickActivePath(sections, "/settings", false)).toBe("/settings");
  });
  it("keeps prefix ownership for detail pages", () => {
    expect(pickActivePath(sections, "/plans/abc", false)).toBe("/plans");
  });
  it("uses the client route for client users", () => {
    expect(pickActivePath(sections, "/client-dashboard", true)).toBe(
      "/client-dashboard",
    );
    expect(pickActivePath(sections, "/", true)).toBeNull();
  });
  it("root only matches itself", () => {
    expect(isActive("/", "/plans")).toBe(false);
    expect(pickActivePath(sections, "/nowhere", false)).toBeNull();
  });
});
