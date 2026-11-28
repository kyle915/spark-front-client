import { executeAuthenticatedGraphQL } from "@/api/relay/environment";
import type { BoardShift } from "./todayAttention";

export interface EventPeekAmbassador {
  uuid: string;
  name: string;
  isApproved: boolean;
}

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
  recapsFiledCount: number;
  approvedRecapHref: string | null;
  ambassadors: EventPeekAmbassador[];
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
    recapsFiledCount?: number | null;
    retailer?: { name?: string | null } | null;
    ambassadors?: ReadonlyArray<{
      uuid?: string | null;
      name?: string | null;
      isApproved?: boolean | null;
    } | null> | null;
    customRecaps?: ReadonlyArray<{
      uuid?: string | null;
      approved?: boolean | null;
    } | null> | null;
    recaps?: ReadonlyArray<{
      uuid?: string | null;
      approved?: boolean | null;
    } | null> | null;
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
      recapsFiledCount
      retailer {
        name
      }
      ambassadors {
        uuid
        name
        isApproved
      }
      customRecaps {
        uuid
        approved
      }
      recaps {
        uuid
        approved
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

export function invalidateEventPeekCache(eventUuid?: string): void {
  if (eventUuid) eventPeekCache.delete(eventUuid);
  else eventPeekCache.clear();
}

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

  const approvedCustom = (ev.customRecaps ?? []).find(
    (r) => r?.uuid && r.approved,
  );
  const approvedLegacy = (ev.recaps ?? []).find((r) => r?.uuid && r.approved);
  const approvedRecapHref = approvedCustom?.uuid
    ? `/recap/view-custom/${approvedCustom.uuid}`
    : approvedLegacy?.uuid
      ? `/recap/view/${approvedLegacy.uuid}`
      : null;

  const ambassadors: EventPeekAmbassador[] = (ev.ambassadors ?? [])
    .filter((a): a is NonNullable<typeof a> => Boolean(a?.uuid))
    .map((a) => ({
      uuid: String(a.uuid),
      name: a.name ?? "",
      isApproved: Boolean(a.isApproved),
    }));

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
    recapsFiledCount: Number(ev.recapsFiledCount ?? 0),
    approvedRecapHref,
    ambassadors,
  };
  if (eventPeekCache.size >= 80) {
    const first = eventPeekCache.keys().next().value;
    if (first) eventPeekCache.delete(first);
  }
  eventPeekCache.set(eventUuid, detail);
  return detail;
}

export interface CalendarShiftSignal {
  ambassadorCount: number;
  recapsFiledCount: number;
  onClock: boolean;
  liveShift: BoardShift | null;
}

type CalendarSignalsPayload = {
  events?: {
    edges?: ReadonlyArray<{
      node?: {
        uuid?: string | null;
        recapsFiledCount?: number | null;
        ambassadors?: ReadonlyArray<{
          uuid?: string | null;
          isApproved?: boolean | null;
        } | null> | null;
      } | null;
    } | null> | null;
  } | null;
  liveShiftBoard?: ReadonlyArray<{
    eventUuid?: string | null;
    eventName?: string | null;
    brandName?: string | null;
    store?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    startLocal?: string | null;
    endLocal?: string | null;
    lastClockInTapAt?: string | null;
    onClock?: number | null;
    assigned?: ReadonlyArray<{
      ambassadorUuid?: string | null;
      name?: string | null;
      status?: string | null;
      clockInAt?: string | null;
      clockOutAt?: string | null;
      pendingApproval?: boolean | null;
      registeredAt?: string | null;
    } | null> | null;
  } | null> | null;
};

const CALENDAR_CLIENT_SIGNALS_QUERY = `
  query CalendarClientSignalsQuery($filters: EventFiltersInput, $first: Int) {
    events(filters: $filters, first: $first) {
      edges {
        node {
          uuid
          recapsFiledCount
        }
      }
    }
  }
`;

const CALENDAR_STAFF_SIGNALS_QUERY = `
  query CalendarStaffSignalsQuery(
    $filters: EventFiltersInput
    $first: Int
    $today: String
    $tenantId: ID
    $includeLive: Boolean!
  ) {
    events(filters: $filters, first: $first) {
      edges {
        node {
          uuid
          recapsFiledCount
          ambassadors {
            uuid
            isApproved
          }
        }
      }
    }
    liveShiftBoard(date: $today, tenantId: $tenantId) @include(if: $includeLive) {
      eventUuid
      eventName
      brandName
      store
      startTime
      endTime
      startLocal
      endLocal
      lastClockInTapAt
      onClock
      assigned {
        ambassadorUuid
        name
        status
        clockInAt
        clockOutAt
        pendingApproval
        registeredAt
      }
    }
  }
`;

export async function fetchCalendarShiftSignals(opts: {
  tenantId: string | null;
  startDate: string;
  endDate: string;
  todayYmd: string | null;
  isClient: boolean;
}): Promise<Map<string, CalendarShiftSignal>> {
  const filters: Record<string, unknown> = {
    startDate: opts.startDate,
    endDate: opts.endDate,
  };
  if (opts.tenantId) filters.tenantId = opts.tenantId;

  const res = await executeAuthenticatedGraphQL<CalendarSignalsPayload>(
    opts.isClient ? CALENDAR_CLIENT_SIGNALS_QUERY : CALENDAR_STAFF_SIGNALS_QUERY,
    opts.isClient
      ? { filters, first: 100 }
      : {
          filters,
          first: 100,
          today: opts.todayYmd,
          tenantId: opts.tenantId,
          includeLive: Boolean(opts.todayYmd),
        },
    { operationKind: "query" },
  );

  const out = new Map<string, CalendarShiftSignal>();
  for (const edge of res.data?.events?.edges ?? []) {
    const n = edge?.node;
    if (!n?.uuid) continue;
    const uuid = String(n.uuid);
    out.set(uuid, {
      ambassadorCount: opts.isClient ? 0 : (n.ambassadors?.length ?? 0),
      recapsFiledCount: Number(n.recapsFiledCount ?? 0),
      onClock: false,
      liveShift: null,
    });
  }

  if (!opts.isClient) {
    for (const row of res.data?.liveShiftBoard ?? []) {
      if (!row?.eventUuid) continue;
      const uuid = String(row.eventUuid);
      const assigned = (row.assigned ?? [])
        .filter((a): a is NonNullable<typeof a> => Boolean(a?.ambassadorUuid))
        .map((a) => ({
          ambassadorUuid: String(a.ambassadorUuid),
          name: a.name ?? "",
          status: (a.status ?? "").toLowerCase(),
          clockInAt: a.clockInAt ?? null,
          clockOutAt: a.clockOutAt ?? null,
          pendingApproval: Boolean(a.pendingApproval),
          registeredAt: a.registeredAt ?? null,
        }));
      const onClock =
        Number(row.onClock ?? 0) > 0 ||
        assigned.some((a) => Boolean(a.clockInAt && !a.clockOutAt));
      const boardShift: BoardShift = {
        eventUuid: uuid,
        eventName: row.eventName ?? "",
        brandName: row.brandName ?? "",
        store: row.store ?? "",
        startTime: row.startLocal ?? row.startTime ?? "",
        endTime: row.endLocal ?? row.endTime ?? "",
        startInstant: row.startTime ?? null,
        lastClockInTapAt: row.lastClockInTapAt ?? null,
        assigned,
      };
      const existing = out.get(uuid);
      out.set(uuid, {
        ambassadorCount: Math.max(existing?.ambassadorCount ?? 0, assigned.length),
        recapsFiledCount: existing?.recapsFiledCount ?? 0,
        onClock,
        liveShift: boardShift,
      });
    }
  }

  return out;
}
