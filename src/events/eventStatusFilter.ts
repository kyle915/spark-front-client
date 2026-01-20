import type { EventStatusFilterEnum } from "@api/queries/__generated__/EventsQuery.graphql";

type EventStatusSource = {
  slug?: string | null;
  name?: string | null;
};

const EVENT_STATUS_FILTER_MAP: Record<string, EventStatusFilterEnum> = {
  approved: "APPROVED",
  declined: "DECLINED",
  suspended: "SUSPENDED",
  archived: "ARCHIVED",
  pending: "PENDING",
};

export const toEventStatusFilterEnum = (
  status: EventStatusSource,
): EventStatusFilterEnum | null => {
  const key = (status.slug || status.name || "").trim().toLowerCase();
  return EVENT_STATUS_FILTER_MAP[key] ?? null;
};
