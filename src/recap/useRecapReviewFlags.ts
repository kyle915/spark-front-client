import { useEffect, useMemo, useRef, useState } from "react";
import { useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { RecapReviewFlagsQuery } from "@/api/queries/RecapReviewFlagsQuery";
import type { RecapReviewFlagsQuery as RecapReviewFlagsQueryType } from "@api/queries/__generated__/RecapReviewFlagsQuery.graphql";
import type { ReviewFlagSummary } from "./reviewCheckDisplay";

type FlagTarget = {
  id: string;
  kind: "legacy" | "custom";
};

const MAX_BATCH = 50;

/**
 * One GraphQL round-trip per kind for the visible Needs-review page.
 * Returns a map of relay id → flagged summaries (empty when clean).
 */
export function useRecapReviewFlags(
  targets: readonly FlagTarget[],
  enabled: boolean,
): Map<string, ReviewFlagSummary[]> {
  const environment = useRelayEnvironment();
  const [byId, setById] = useState<Map<string, ReviewFlagSummary[]>>(
    () => new Map(),
  );
  const signature = useMemo(() => {
    if (!enabled) return "";
    return targets
      .slice(0, MAX_BATCH * 2)
      .map((t) => `${t.kind}:${t.id}`)
      .join("|");
  }, [enabled, targets]);
  const lastSig = useRef("");

  useEffect(() => {
    if (!enabled || !signature) {
      setById(new Map());
      lastSig.current = "";
      return;
    }
    if (signature === lastSig.current) return;
    lastSig.current = signature;

    let cancelled = false;
    const legacyIds = targets
      .filter((t) => t.kind === "legacy")
      .map((t) => t.id)
      .slice(0, MAX_BATCH);
    const customIds = targets
      .filter((t) => t.kind === "custom")
      .map((t) => t.id)
      .slice(0, MAX_BATCH);

    (async () => {
      const next = new Map<string, ReviewFlagSummary[]>();
      const pulls: Promise<void>[] = [];
      if (legacyIds.length > 0) {
        pulls.push(
          fetchQuery<RecapReviewFlagsQueryType>(
            environment,
            RecapReviewFlagsQuery,
            { recapIds: legacyIds, isCustom: false },
          )
            .toPromise()
            .then((data) => {
              for (const row of data?.recapReviewFlags ?? []) {
                if (!row?.recapId) continue;
                next.set(
                  String(row.recapId),
                  (row.flags ?? [])
                    .filter((f): f is ReviewFlagSummary =>
                      Boolean(f && f.code && f.label),
                    )
                    .map((f) => ({ code: f.code, label: f.label })),
                );
              }
            })
            .catch(() => {
              /* advisory — quiet fail leaves empty badges */
            }),
        );
      }
      if (customIds.length > 0) {
        pulls.push(
          fetchQuery<RecapReviewFlagsQueryType>(
            environment,
            RecapReviewFlagsQuery,
            { recapIds: customIds, isCustom: true },
          )
            .toPromise()
            .then((data) => {
              for (const row of data?.recapReviewFlags ?? []) {
                if (!row?.recapId) continue;
                next.set(
                  String(row.recapId),
                  (row.flags ?? [])
                    .filter((f): f is ReviewFlagSummary =>
                      Boolean(f && f.code && f.label),
                    )
                    .map((f) => ({ code: f.code, label: f.label })),
                );
              }
            })
            .catch(() => {
              /* advisory — quiet fail */
            }),
        );
      }
      await Promise.all(pulls);
      if (!cancelled) setById(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, environment, signature, targets]);

  return byId;
}
