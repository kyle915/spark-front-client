import { executeAuthenticatedGraphQL } from "@/api/relay/environment";

export interface EventPeekDetail {
  id: string;
  uuid: string;
  name: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  address: string | null;
  notes: string | null;
  retailerName: string | null;
  requestUuid: string | null;
  onsitePoc: string | null;
  storeManagerName: string | null;
  storeManagerPhone: string | null;
}

type EventPeekGraphQLPayload = {
  event?: {
    id?: string | null;
    uuid?: string | null;
    name?: string | null;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    address?: string | null;
    notes?: string | null;
    retailer?: { name?: string | null } | null;
    request?: {
      uuid?: string | null;
      onsitePoc?: string | null;
      storeManagerName?: string | null;
      storeManagerPhone?: string | null;
      notes?: string | null;
    } | null;
  } | null;
};

const EVENT_PEEK_QUERY = `
  query DashboardEventPeekQuery($uuid: ID!) {
    event(uuid: $uuid) {
      id
      uuid
      name
      date
      startTime
      endTime
      address
      notes
      retailer {
        name
      }
      request {
        uuid
        onsitePoc
        storeManagerName
        storeManagerPhone
        notes
      }
    }
  }
`;

const eventPeekCache = new Map<string, EventPeekDetail>();

export function getCachedEventPeekDetail(
  eventUuid: string,
): EventPeekDetail | null {
  return eventPeekCache.get(eventUuid) ?? null;
}

export async function fetchEventPeekDetail(
  eventUuid: string,
): Promise<EventPeekDetail | null> {
  const cached = eventPeekCache.get(eventUuid);
  if (cached) return cached;
  const res = await executeAuthenticatedGraphQL<EventPeekGraphQLPayload>(
    EVENT_PEEK_QUERY,
    { uuid: eventUuid },
    { operationKind: "query" },
  );
  const ev = res.data?.event;
  if (!ev?.id || !ev?.uuid) return null;
  const detail: EventPeekDetail = {
    id: ev.id,
    uuid: String(ev.uuid),
    name: ev.name ?? "",
    date: ev.date ?? null,
    startTime: ev.startTime ?? null,
    endTime: ev.endTime ?? null,
    address: ev.address ?? null,
    notes: ev.notes || ev.request?.notes || null,
    retailerName: ev.retailer?.name ?? null,
    requestUuid: ev.request?.uuid ? String(ev.request.uuid) : null,
    onsitePoc: ev.request?.onsitePoc ?? null,
    storeManagerName: ev.request?.storeManagerName ?? null,
    storeManagerPhone: ev.request?.storeManagerPhone ?? null,
  };
  if (eventPeekCache.size >= 80) {
    const first = eventPeekCache.keys().next().value;
    if (first) eventPeekCache.delete(first);
  }
  eventPeekCache.set(eventUuid, detail);
  return detail;
}
