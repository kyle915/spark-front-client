/**
 * Clock labels for Today. Status strings come from liveShiftBoard — the
 * same query On the Clock uses. Today only names the BA and the state.
 */

const CLOCK_STATE_LABEL: Record<string, string> = {
  clocked_in: "Clocked in",
  clocked_out: "Clocked out",
  no_show: "No-show",
  missed: "Missed",
  awaiting: "Not in yet",
  upcoming: "Upcoming",
};

export function clockStateLabel(status: string | null | undefined): string {
  if (!status) return "Scheduled";
  return CLOCK_STATE_LABEL[status] ?? "Scheduled";
}

export type TodayAssignee = {
  ambassadorUuid: string;
  name: string;
  status: string;
};

export type TodayShift = {
  eventUuid: string;
  assigned: ReadonlyArray<TodayAssignee>;
};

export function assigneesForEvent(
  eventUuid: string,
  shifts: ReadonlyArray<TodayShift>,
): TodayAssignee[] {
  const shift = shifts.find((row) => row.eventUuid === eventUuid);
  if (!shift) return [];
  return shift.assigned.filter((ba) => ba.name.trim().length > 0);
}
