export type TrackerRowTarget = {
  statusSlug: string;
  recapEventUuid?: string | null;
  eventUuid?: string | null;
  uuid: string;
};

/** Same destination the desktop tracker row uses when the row is opened. */
export function trackerRowDestination(row: TrackerRowTarget): string {
  const isDone = row.statusSlug.toLowerCase() === "done";
  if (row.recapEventUuid) return `/event/view/${row.recapEventUuid}`;
  if (isDone && row.eventUuid) return `/event/view/${row.eventUuid}`;
  if (isDone) return "/recap/list";
  if (row.eventUuid) return `/event/view/${row.eventUuid}`;
  return `/request/view/${row.uuid}`;
}
