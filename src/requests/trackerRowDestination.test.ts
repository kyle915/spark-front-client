import { describe, expect, it } from "vitest";
import { trackerRowDestination } from "./trackerRowDestination";

describe("trackerRowDestination", () => {
  it("opens the request when the row has no event yet", () => {
    expect(
      trackerRowDestination({
        statusSlug: "pending",
        uuid: "req-1",
        eventUuid: null,
      }),
    ).toBe("/request/view/req-1");
  });

  it("opens the event that holds the recap", () => {
    expect(
      trackerRowDestination({
        statusSlug: "done",
        uuid: "req-2",
        eventUuid: "event-low",
        recapEventUuid: "event-recap",
      }),
    ).toBe("/event/view/event-recap");
  });

  it("opens the event for a done row, and the recap list when there is no event", () => {
    expect(
      trackerRowDestination({
        statusSlug: "done",
        uuid: "req-3",
        eventUuid: "event-3",
      }),
    ).toBe("/event/view/event-3");
    expect(
      trackerRowDestination({
        statusSlug: "DONE",
        uuid: "req-4",
        eventUuid: null,
      }),
    ).toBe("/recap/list");
  });
});
