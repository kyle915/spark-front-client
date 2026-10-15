import type { FmEvent } from "./fieldMarketingTypes";

/** Plan-row rules shared by the Plans table, calendar, and form. Mirrors the API. */

export function hasLogged(row: FmEvent): boolean {
  return (
    row.loggedFullCans != null ||
    row.loggedPourSamples != null ||
    row.loggedEmails != null ||
    row.loggedDays != null ||
    row.loggedCases != null
  );
}

/**
 * Tactics that forecast / log full cans and 4oz pours. Mirrors the API: a
 * plan's sampling format is the expected mix, not a limit — an event that
 * pours and also hands out cans logs both.
 */
const SAMPLING_TACTICS = new Set(["sponsorship", "event_activation", "guerilla"]);

export function showsCans(activity: string): boolean {
  return activity === "full_can" || SAMPLING_TACTICS.has(activity);
}

export function showsPours(activity: string): boolean {
  return activity === "pour" || SAMPLING_TACTICS.has(activity);
}

export function showsDays(activity: string): boolean {
  return activity === "sponsorship" || activity === "event_activation";
}

/** Event activation + guerilla take staffing and start/end times. */
export function isStaffedActivity(activity: string): boolean {
  return activity === "event_activation" || activity === "guerilla";
}

/** Matches API `_should_create_request` — staffed activation / guerilla book Ignite. */
export function booksWithIgnite(row: Pick<FmEvent, "activity" | "needsFieldSupport">): boolean {
  if (row.activity === "event_activation" || row.activity === "sponsorship") {
    return true;
  }
  if (
    row.activity === "guerilla" ||
    row.activity === "full_can" ||
    row.activity === "pour"
  ) {
    return Boolean(row.needsFieldSupport);
  }
  return false;
}

/** Booked rows change on the request; everything else edits on the plan. */
export function isBooked(row: FmEvent): boolean {
  return Boolean(row.requestUuid);
}

export function rowStatus(row: FmEvent): string {
  if (row.requestCancelled) return `${row.requestCode ?? "Request"} cancelled`;
  if (row.status === "submitted") {
    return row.requestCode ? `Ignite · ${row.requestCode}` : "On plan";
  }
  if (hasLogged(row)) return "Logged results";
  return "Draft";
}

/** Every half hour, 12:00 AM through 11:30 PM. Overnight and early-AM shifts are real. */
export const TIME_OPTIONS: ReadonlyArray<{ value: string; label: string }> = Array.from(
  { length: 48 },
  (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    const value = `${String(hour).padStart(2, "0")}:${minute}`;
    const label = `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
    return { value, label };
  },
);

export type DeleteCopy = { title: string; body: string; confirmLabel: string };

export function deleteConfirmCopy(row: FmEvent): DeleteCopy {
  const title = `Delete “${row.name}”?`;
  switch (row.deleteEffect) {
    case "cancel_request":
      return {
        title,
        body: `This also cancels ${row.requestCode ?? "the linked request"} — it comes off the Master Tracker and any open BA jobs close. No email goes to the BA or the brand.`,
        confirmLabel: `Delete + cancel ${row.requestCode ?? "request"}`,
      };
    case "keep_request":
      return {
        title,
        body: `${row.requestCode ?? "The request"} already happened or has a recap, so the request and recap stay. Only the plan is removed.`,
        confirmLabel: "Delete plan",
      };
    case "remove":
      return {
        title,
        body:
          row.status === "submitted"
            ? "The plan comes off the board and out of the projected totals. Ignite gets a heads-up."
            : "The draft comes off the board and out of the projected totals.",
        confirmLabel: "Delete plan",
      };
    default: {
      const unknown: never = row.deleteEffect;
      return { title, body: String(unknown), confirmLabel: "Delete plan" };
    }
  }
}

export function requestFormHref(row: FmEvent): string {
  const params = new URLSearchParams();
  params.set("venue", row.name || "");
  if (row.address) params.set("address", row.address);
  if (row.startsOn) params.set("date", row.startsOn.slice(0, 10));
  params.set("requestTypeName", "Event Activation");
  params.set("schedulingStatus", "needs_scheduling");
  if (row.ambassadorCount) params.set("baCount", String(row.ambassadorCount));
  if (row.supportTimes) params.set("loadInTime", row.supportTimes);
  if (row.managerName) params.set("onsitePoc", row.managerName);
  const teamParts: string[] = [];
  if (row.supportScope) teamParts.push(row.supportScope);
  if (row.samplingLabel) teamParts.push(`Sampling: ${row.samplingLabel}`);
  if (row.days > 1) teamParts.push(`${row.days} days`);
  if (row.skuNames?.length) teamParts.push(`SKUs: ${row.skuNames.join(", ")}`);
  if (teamParts.length) params.set("additionalTeamDetails", teamParts.join(" · "));
  const noteBits = [
    row.marketLabel ? `Market: ${row.marketLabel}` : "",
    row.activityLabel ? `Tactic: ${row.activityLabel}` : "",
    row.notes || "",
  ].filter(Boolean);
  if (noteBits.length) params.set("notes", noteBits.join("\n"));
  return `/requests/create?${params.toString()}`;
}
