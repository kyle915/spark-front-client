import { describe, expect, it } from "vitest";
import { checkinSteps } from "./checkinSteps";

const states = (s: ReturnType<typeof checkinSteps>) => s.map((x) => x.state).join(",");

describe("checkinSteps", () => {
  it("starts at Your info", () => {
    expect(states(checkinSteps({ identified: false, clockState: null, hasRecap: false }))).toBe(
      "current,todo,todo,todo",
    );
  });
  it("moves to Clock in once identified", () => {
    expect(states(checkinSteps({ identified: true, clockState: "not_started", hasRecap: false }))).toBe(
      "done,current,todo,todo",
    );
  });
  it("points at the recap while on the clock", () => {
    expect(states(checkinSteps({ identified: true, clockState: "clocked_in", hasRecap: false }))).toBe(
      "done,done,current,todo",
    );
  });
  it("points at Clock out once the recap is filed", () => {
    expect(states(checkinSteps({ identified: true, clockState: "clocked_in", hasRecap: true }))).toBe(
      "done,done,done,current",
    );
  });
  it("keeps the recap current when auto-clocked-out without one", () => {
    expect(states(checkinSteps({ identified: true, clockState: "clocked_out", hasRecap: false }))).toBe(
      "done,done,current,done",
    );
  });
  it("is all done at the end", () => {
    expect(states(checkinSteps({ identified: true, clockState: "clocked_out", hasRecap: true }))).toBe(
      "done,done,done,done",
    );
  });
  it("recap-only links have two steps", () => {
    const s = checkinSteps({ identified: true, clockState: null, hasRecap: false, recapOnly: true });
    expect(s.map((x) => x.label)).toEqual(["Your info", "Recap"]);
    expect(states(s)).toBe("done,current");
  });
});
