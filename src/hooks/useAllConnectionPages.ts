import { useEffect, useMemo, useState } from "react";
import {
  fetchQuery,
  useLazyLoadQuery,
  useRelayEnvironment,
} from "react-relay";
import type {
  FetchPolicy,
  GraphQLTaggedNode,
  OperationType,
} from "relay-runtime";

/**
 * Every row a list query asks for, walked page by page.
 *
 * Brand (non-admin) users get at most 200 rows per request: the server
 * quietly clamps any larger `first` to 200 and reports `hasNextPage`. A
 * screen that asked for `first: 1000` in one go would draw the first 200
 * and look finished. This asks for the same `first`, then follows
 * `endCursor` until the server says there is no more or `maxNodes` rows are
 * in hand.
 *
 * Admins are not clamped, so their first page already holds `first` rows
 * and nothing more is fetched: their requests are exactly what they were.
 *
 * The first page suspends like any `useLazyLoadQuery`; later pages arrive
 * after it (`loadingMore` while they do). The query must take `$after` and
 * select `pageInfo { hasNextPage endCursor }` on the connection.
 */

/** The most rows the server returns per request to a brand user. */
export const BRAND_PAGE_CAP = 200;

/** A guard against a runaway walk, not a target. */
export const MAX_EXTRA_PAGES = 25;

type Edge<N> = { readonly node?: N | null } | null | undefined;

export type ConnectionLike<N> =
  | {
      readonly edges?: ReadonlyArray<Edge<N>> | null;
      readonly pageInfo?: {
        readonly hasNextPage: boolean;
        readonly endCursor?: string | null;
      } | null;
      readonly totalCount?: number | null;
    }
  | null
  | undefined;

export function connectionNodes<N>(connection: ConnectionLike<N>): N[] {
  return (connection?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is N => n != null);
}

const defaultKey = (n: unknown): string => {
  const o = n as { id?: unknown; uuid?: unknown } | null;
  return String(o?.id ?? o?.uuid ?? JSON.stringify(n));
};

/** Append pages, keeping the first copy of each row, up to `max` rows. */
export function mergeConnectionPages<N>(
  pages: ReadonlyArray<ReadonlyArray<N>>,
  max: number = Number.POSITIVE_INFINITY,
  keyOf: (n: N) => string = defaultKey,
): N[] {
  const seen = new Set<string>();
  const out: N[] = [];
  for (const page of pages) {
    for (const n of page) {
      if (out.length >= max) return out;
      const key = keyOf(n);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}

/** True while another page is worth asking for. */
export function wantsAnotherPage(
  connection: ConnectionLike<unknown>,
  have: number,
  maxNodes: number,
): boolean {
  const info = connection?.pageInfo;
  return Boolean(info?.hasNextPage && info.endCursor && have < maxNodes);
}

export function useAllConnectionPages<Q extends OperationType, N>(
  query: GraphQLTaggedNode,
  variables: Q["variables"] & { first?: number | null },
  select: (response: Q["response"]) => ConnectionLike<N>,
  options: {
    fetchPolicy?: FetchPolicy;
    fetchKey?: string | number;
    /** Stop once this many rows are in hand. Defaults to `variables.first`. */
    maxNodes?: number;
    keyOf?: (n: N) => string;
  } = {},
): {
  data: Q["response"];
  nodes: N[];
  loadingMore: boolean;
  totalCount: number | null;
} {
  const environment = useRelayEnvironment();
  const maxNodes =
    options.maxNodes ?? variables.first ?? Number.POSITIVE_INFINITY;
  const data = useLazyLoadQuery<Q>(query, variables, {
    fetchPolicy: options.fetchPolicy ?? "store-or-network",
    fetchKey: options.fetchKey,
  });
  const firstConnection = select(data);
  const [rest, setRest] = useState<N[][]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const variablesKey = JSON.stringify(variables);

  useEffect(() => {
    let cancelled = false;
    setRest([]);
    const firstNodes = connectionNodes(firstConnection);
    if (!wantsAnotherPage(firstConnection, firstNodes.length, maxNodes)) {
      setLoadingMore(false);
      return;
    }
    setLoadingMore(true);
    (async () => {
      let cursor = firstConnection?.pageInfo?.endCursor ?? null;
      let have = firstNodes.length;
      const pages: N[][] = [];
      for (let page = 0; cursor && page < MAX_EXTRA_PAGES; page += 1) {
        const res = await fetchQuery<Q>(
          environment,
          query,
          { ...variables, after: cursor },
          { fetchPolicy: "network-only" },
        ).toPromise();
        if (cancelled) return;
        if (!res) break;
        const connection = select(res);
        const rows = connectionNodes(connection);
        pages.push(rows);
        have += rows.length;
        setRest([...pages]);
        if (rows.length === 0 || !wantsAnotherPage(connection, have, maxNodes)) {
          break;
        }
        cursor = connection?.pageInfo?.endCursor ?? null;
      }
      if (!cancelled) setLoadingMore(false);
    })().catch(() => {
      // The network layer already told the person (e.g. a rate limit);
      // keep the rows we have.
      if (!cancelled) setLoadingMore(false);
    });
    return () => {
      cancelled = true;
    };
    // variablesKey stands in for `variables` (a new object every render);
    // `select` / `query` are stable per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, data, variablesKey, maxNodes]);

  const nodes = useMemo(
    () =>
      mergeConnectionPages(
        [connectionNodes(firstConnection), ...rest],
        maxNodes,
        options.keyOf,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, rest, maxNodes],
  );

  return {
    data,
    nodes,
    loadingMore,
    totalCount: firstConnection?.totalCount ?? null,
  };
}
