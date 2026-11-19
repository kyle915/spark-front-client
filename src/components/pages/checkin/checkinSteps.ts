/**
 * The check-in journey as a short step list, so a BA always knows where they
 * are and what's left: Your info → Clock in → Recap → Clock out.
 * Recap-only links have no clock, so they show just Your info → Recap.
 * Time-sheet-only links have no recap: Your info → Clock in → Clock out.
 */
export type CheckinStepState = "done" | "current" | "todo";
export type CheckinStep = { key: string; label: string; state: CheckinStepState };

export function checkinSteps(input: {
  identified: boolean;
  clockState: "not_started" | "clocked_in" | "clocked_out" | null | undefined;
  hasRecap: boolean;
  recapOnly?: boolean;
  timesheetOnly?: boolean;
}): CheckinStep[] {
  const { identified, hasRecap, recapOnly, timesheetOnly } = input;
  const clock = input.clockState ?? "not_started";
  if (timesheetOnly && !recapOnly) {
    const doneTs: Record<string, boolean> = {
      info: identified,
      in: identified && clock !== "not_started",
      out: identified && clock === "clocked_out",
    };
    let taken = false;
    return (
      [
        ["info", "Your info"],
        ["in", "Clock in"],
        ["out", "Clock out"],
      ] as [string, string][]
    ).map(([key, label]) => {
      if (doneTs[key]) return { key, label, state: "done" as const };
      if (!taken) {
        taken = true;
        return { key, label, state: "current" as const };
      }
      return { key, label, state: "todo" as const };
    });
  }
  const done: Record<string, boolean> = recapOnly
    ? { info: identified, recap: hasRecap }
    : {
        info: identified,
        in: identified && clock !== "not_started",
        recap: hasRecap,
        out: identified && clock === "clocked_out",
      };
  const order: [string, string][] = recapOnly
    ? [
        ["info", "Your info"],
        ["recap", "Recap"],
      ]
    : [
        ["info", "Your info"],
        ["in", "Clock in"],
        ["recap", "Recap"],
        ["out", "Clock out"],
      ];
  let currentTaken = false;
  return order.map(([key, label]) => {
    if (done[key]) return { key, label, state: "done" as const };
    if (!currentTaken) {
      currentTaken = true;
      return { key, label, state: "current" as const };
    }
    return { key, label, state: "todo" as const };
  });
}
