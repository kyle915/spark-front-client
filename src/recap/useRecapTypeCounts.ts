import { useEffect, useState } from "react";
import { useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { RecapTypeCountsQuery } from "@/api/queries/RecapTypeCountsQuery";
import type {
  RecapTypeCountsQuery as RecapTypeCountsQueryType,
  RecapTypeCountsQuery$variables,
} from "@api/queries/__generated__/RecapTypeCountsQuery.graphql";

type RecapTypeCounts = NonNullable<
  RecapTypeCountsQueryType["response"]["recapTypeCounts"]
>;

/**
 * `recapTypeCounts` for the current list filters. Keeps the last answer
 * while a new one loads so the chips never blank out mid-typing.
 */
export function useRecapTypeCounts(
  variables: RecapTypeCountsQuery$variables | null,
  refreshKey: number,
): RecapTypeCounts | null {
  const environment = useRelayEnvironment();
  const [counts, setCounts] = useState<RecapTypeCounts | null>(null);
  const key = variables ? JSON.stringify(variables) : "";
  useEffect(() => {
    if (!key) {
      setCounts(null);
      return;
    }
    let sub: { unsubscribe: () => void } | null = null;
    const timer = window.setTimeout(() => {
      sub = fetchQuery<RecapTypeCountsQueryType>(
        environment,
        RecapTypeCountsQuery,
        JSON.parse(key) as RecapTypeCountsQuery$variables,
        { fetchPolicy: "network-only" },
      ).subscribe({
        next: (data) => setCounts(data.recapTypeCounts ?? null),
        error: () => {},
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      sub?.unsubscribe();
    };
  }, [environment, key, refreshKey]);
  return counts;
}
