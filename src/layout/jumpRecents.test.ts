import { afterEach, describe, expect, it } from "vitest";
import {
  JUMP_GROUP_ORDER,
  clearJumpRecents,
  jumpGroupOf,
  loadJumpRecents,
  rememberJumpRecent,
} from "./jumpRecents";

afterEach(() => {
  clearJumpRecents();
});

describe("jumpRecents", () => {
  it("persists last 8 and dedupes by id", () => {
    for (let i = 0; i < 10; i += 1) {
      rememberJumpRecent({
        id: `page-${i}`,
        label: `Page ${i}`,
        hint: "Pages",
        to: `/${i}`,
      });
    }
    rememberJumpRecent({
      id: "page-9",
      label: "Page 9 again",
      hint: "Pages",
      to: "/9",
    });
    const recents = loadJumpRecents();
    expect(recents).toHaveLength(8);
    expect(recents[0].id).toBe("page-9");
    expect(recents[0].label).toBe("Page 9 again");
  });

  it("groups Jump rows", () => {
    expect(jumpGroupOf("recent-dashboard")).toBe("recents");
    expect(jumpGroupOf("recap-abc")).toBe("recaps");
    expect(jumpGroupOf("crecap-xyz")).toBe("recaps");
    expect(jumpGroupOf("req-1")).toBe("requests");
    expect(jumpGroupOf("ba-2")).toBe("people");
    expect(jumpGroupOf("dashboard")).toBe("pages");
    expect(JUMP_GROUP_ORDER[0]).toBe("recents");
  });
});
