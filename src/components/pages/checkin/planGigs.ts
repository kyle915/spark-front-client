/**
 * "Is this one of today's scheduled events?" — the brand's plan gigs on the
 * picked date and program. Picking one puts the BA (and their recap) on the
 * plan's booked event, which is what feeds the plan's Actuals.
 */

export type PlanGig = {
  id: string;
  name: string;
  area: string;
  typeLabel: string;
  startTime: string | null;
  endTime: string | null;
  timeZone: string;
};

/** Sent as `planEventId` when the BA says it isn't a scheduled event. */
export const PLAN_GIG_NONE = "none";

export const PLAN_GIG_MISSING_ERROR =
  "Tell us if this is one of the scheduled events above ↑";

export function planGigQuestion(eventDate: string, today: string): string {
  return eventDate === today
    ? "Is this one of today's scheduled events?"
    : "Is this one of that day's scheduled events?";
}

/** True when the list is showing and the BA hasn't answered it. */
export function planGigUnanswered(gigs: ReadonlyArray<PlanGig>, answer: string): boolean {
  return gigs.length > 0 && !answer;
}

/** The picked gig, or null for "no" / unanswered / a gig no longer listed. */
export function pickedPlanGig(gigs: ReadonlyArray<PlanGig>, answer: string): PlanGig | null {
  if (!answer || answer === PLAN_GIG_NONE) return null;
  return gigs.find((g) => g.id === answer) ?? null;
}

/** Keep the answer only while it still names a listed gig (or is "no"). */
export function keepPlanGigAnswer(gigs: ReadonlyArray<PlanGig>, answer: string): string {
  if (answer === PLAN_GIG_NONE) return gigs.length ? answer : "";
  return gigs.some((g) => g.id === answer) ? answer : "";
}

export function planGigTimes(gig: PlanGig): string {
  if (!gig.startTime) return "";
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: gig.timeZone || undefined,
      });
    } catch {
      return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
  };
  return gig.endTime ? `${fmt(gig.startTime)}–${fmt(gig.endTime)}` : fmt(gig.startTime);
}

export async function fetchPlanGigs(opts: {
  origin: string;
  code: string;
  eventDate: string;
  eventTypeId: string;
}): Promise<PlanGig[]> {
  try {
    const res = await fetch(
      `${opts.origin}/api/public/checkin/${encodeURIComponent(opts.code)}/plan-gigs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDate: opts.eventDate, eventTypeId: opts.eventTypeId }),
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { gigs?: PlanGig[] };
    return Array.isArray(json.gigs) ? json.gigs : [];
  } catch {
    return [];
  }
}
