import { describe, expect, it } from "vitest";
import {
  cleanEventName,
  formatEventDate,
  formatTimelineDay,
  joinDistinct,
  timelineKind,
} from "./eventLabel";

describe("cleanEventName", () => {
  it("strips a walk-in title's leading date", () => {
    expect(cleanEventName("11/23/2026 - 42nd St & 8th Ave, New York, NY 10036")).toBe(
      "42nd St & 8th Ave, New York, NY 10036",
    );
  });

  it("strips embedded and clipped date segments", () => {
    expect(cleanEventName("11/21/2026 - Product Seeding · BA 769 · 2026-11-21")).toBe(
      "Product Seeding · BA 769",
    );
    expect(cleanEventName("11/21/2026 - Product Seeding · BA 769 · 2026-11")).toBe(
      "Product Seeding · BA 769",
    );
  });

  it("keeps names without dates and metro names", () => {
    expect(cleanEventName("Miami — Wynwood · 9/24")).toBe("Miami — Wynwood");
    expect(cleanEventName("Vons Sparks")).toBe("Vons Sparks");
    expect(cleanEventName("7-Eleven #42")).toBe("7-Eleven #42");
  });
});

describe("formatEventDate", () => {
  it("prints one consistent date with no UTC day shift", () => {
    expect(formatEventDate("2026-11-23")).toBe("Nov 23, 2026");
    expect(formatEventDate("2026-11-23T02:00:00Z")).toBe("Nov 23, 2026");
  });
});

describe("joinDistinct", () => {
  it("drops parts already said", () => {
    expect(
      joinDistinct(["42nd St, New York, NY 10036", "42nd St, New York, NY", "New York, NY"]),
    ).toBe("42nd St, New York, NY 10036");
  });
});

describe("timeline rows", () => {
  it("reads the server status, not a UTC-parsed date", () => {
    expect(timelineKind("Today")).toBe("today");
    expect(timelineKind("Upcoming")).toBe("upcoming");
    expect(timelineKind("Recapped")).toBe("past");
    expect(timelineKind("Recap pending")).toBe("past");
  });

  it("prints the event's own calendar day", () => {
    expect(formatTimelineDay("2026-11-23")).toBe("Mon, Nov 23");
  });
});
