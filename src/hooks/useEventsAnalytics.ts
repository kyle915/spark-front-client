type EventLike = {
  eventType?: { name?: string | null } | null;
  status?: { name?: string | null } | null;
  date?: string | null;
};

const fallbackLabel = "Unknown";

const increment = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] ?? 0) + 1;
};

export function useEventsAnalytics(events: EventLike[] = []) {
  const types: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const dates: Record<string, number> = {};

  events.forEach((event) => {
    const typeLabel = event.eventType?.name ?? fallbackLabel;
    const statusLabel = event.status?.name ?? fallbackLabel;
    const dateLabel = event.date ?? fallbackLabel;

    increment(types, typeLabel);
    increment(statuses, statusLabel);
    increment(dates, dateLabel);
  });

  return { types, statuses, dates };
}
