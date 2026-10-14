import { describe, expect, it } from "vitest";
import {
  PLAN_GIG_NONE,
  keepPlanGigAnswer,
  pickedPlanGig,
  planGigQuestion,
  planGigTimes,
  planGigUnanswered,
  type PlanGig,
} from "./planGigs";

const gig: PlanGig = {
  id: "6446",
  name: "RARE Steak Championship Houston",
  area: "Houston, TX",
  typeLabel: "Event Activation",
  startTime: "2026-10-15T22:00:00+00:00",
  endTime: "2026-10-16T02:00:00+00:00",
  timeZone: "America/Chicago",
};

describe("plan gig pick-list", () => {
  it("must be answered only when gigs are listed", () => {
    expect(planGigUnanswered([], "")).toBe(false);
    expect(planGigUnanswered([gig], "")).toBe(true);
    expect(planGigUnanswered([gig], PLAN_GIG_NONE)).toBe(false);
    expect(planGigUnanswered([gig], gig.id)).toBe(false);
  });

  it("resolves the picked gig and drops stale answers", () => {
    expect(pickedPlanGig([gig], gig.id)).toBe(gig);
    expect(pickedPlanGig([gig], PLAN_GIG_NONE)).toBeNull();
    expect(keepPlanGigAnswer([gig], gig.id)).toBe(gig.id);
    expect(keepPlanGigAnswer([], gig.id)).toBe("");
    expect(keepPlanGigAnswer([], PLAN_GIG_NONE)).toBe("");
    expect(keepPlanGigAnswer([gig], PLAN_GIG_NONE)).toBe(PLAN_GIG_NONE);
  });

  it("asks about the picked day and shows the gig's local times", () => {
    expect(planGigQuestion("2026-10-15", "2026-10-15")).toBe("Is this one of today's scheduled events?");
    expect(planGigQuestion("2026-10-14", "2026-10-15")).toBe("Is this one of that day's scheduled events?");
    expect(planGigTimes(gig)).toMatch(/5:00\s?PM–9:00\s?PM/);
    expect(planGigTimes({ ...gig, startTime: null })).toBe("");
  });
});
