import { useEffect, useMemo, useState } from "react";
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from "react-relay";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type {
  EventFiltersInput,
  EventsQuery as EventsQueryType,
} from "@api/queries/__generated__/EventsQuery.graphql";

/**
 * Every event matching `filters`, page by page.
 *
 * The events list returns at most 100 rows a request, whatever `first` asks
 * for, so a single `first: 200` / `first: 500` quietly stopped at 100 (and the
 * list is newest-date first, so the near days were the ones dropped). The
 * first page suspends like any query; the rest are fetched after it and added
 * as they arrive (`loadingMore` while they do).
 */

export const EVENTS_PAGE_SIZE = 100;
// A guard, not a target: 20 pages = 2,000 events in one window.
export const EVENTS_MAX_PAGES = 20;

type Connection = EventsQueryType["response"]["events"];
export type EventNode = NonNullable<Connection["edges"][number]>["node"];

export function nodesOf(connection: Connection | null | undefined): EventNode[] {
  return (connection?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is EventNode => Boolean(n));
}

/** Append pages, keeping the first copy of each event. */
export function mergeEventPages(pages: ReadonlyArray<ReadonlyArray<EventNode>>): EventNode[] {
  const seen = new Set<string>();
  const out: EventNode[] = [];
  for (const page of pages) {
    for (const n of page) {
      const key = String(n.uuid ?? n.id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}

export function useAllEventPages(filters: EventFiltersInput | null): {
  events: EventNode[];
  loadingMore: boolean;
  totalCount: number;
} {
  const environment = useRelayEnvironment();
  const first = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    { first: EVENTS_PAGE_SIZE, filters },
    { fetchPolicy: "store-or-network" },
  );
  const [rest, setRest] = useState<EventNode[][]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const filtersKey = JSON.stringify(filters ?? null);

  useEffect(() => {
    let cancelled = false;
    setRest([]);
    const info = first.events.pageInfo;
    if (!info.hasNextPage || !info.endCursor) {
      setLoadingMore(false);
      return;
    }
    setLoadingMore(true);
    (async () => {
      let cursor: string | null = info.endCursor ?? null;
      let more = info.hasNextPage;
      const pages: EventNode[][] = [];
      for (let page = 1; more && cursor && page < EVENTS_MAX_PAGES; page += 1) {
        const res = await fetchQuery<EventsQueryType>(
          environment,
          EventsQuery,
          { first: EVENTS_PAGE_SIZE, after: cursor, filters },
          { fetchPolicy: "network-only" },
        ).toPromise();
        if (cancelled) return;
        if (!res) break;
        pages.push(nodesOf(res.events));
        setRest([...pages]);
        cursor = res.events.pageInfo.endCursor ?? null;
        more = res.events.pageInfo.hasNextPage;
      }
      if (!cancelled) setLoadingMore(false);
    })().catch(() => {
      if (!cancelled) setLoadingMore(false);
    });
    return () => {
      cancelled = true;
    };
    // filtersKey stands in for `filters` (a new object every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, first, filtersKey]);

  const events = useMemo(
    () => mergeEventPages([nodesOf(first.events), ...rest]),
    [first, rest],
  );
  return { events, loadingMore, totalCount: first.events.totalCount ?? events.length };
}
