import { useEffect, useMemo, useRef, useState } from "react";
import { useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { RecapReviewTriageQuery } from "@/api/queries/RecapReviewTriageQuery";
import type { RecapReviewTriageQuery as RecapReviewTriageQueryType } from "@api/queries/__generated__/RecapReviewTriageQuery.graphql";
import {
  parseRecapTriageLabel,
  type RecapTriageReason,
  type RecapTriageSummary,
} from "./recapTriage";

type FlagTarget = {
  id: string;
  kind: "legacy" | "custom";
};

const MAX_BATCH = 50;

/**
 * Staff-only batched Clean / Needs Eyes labels for the Needs-review page.
 * Pass the unfiltered review set (not the Clean/Needs Eyes-filtered list).
 * Quiet-fails to an empty map — callers must treat missing ids as unresolved,
 * never as Clean. Never call with isClient — the resolver refuses brand users.
 */
export function useRecapReviewTriage(
  targets: readonly FlagTarget[],
  enabled: boolean,
): { byId: Map<string, RecapTriageSummary>; settled: boolean } {
  const environment = useRelayEnvironment();
  const [byId, setById] = useState<Map<string, RecapTriageSummary>>(
    () => new Map(),
  );
  const [settled, setSettled] = useState(() => !enabled || targets.length === 0);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const signature = useMemo(() => {
    if (!enabled) return "";
    return targets
      .slice(0, MAX_BATCH * 2)
      .map((t) => `${t.kind}:${t.id}`)
      .join("|");
  }, [enabled, targets]);
  useEffect(() => {
    if (!enabled || !signature) {
      setById(new Map());
      setSettled(true);
      return;
    }
    setSettled(false);

    let cancelled = false;
    const batch = targetsRef.current;
    const legacyIds = batch
      .filter((t) => t.kind === "legacy")
      .map((t) => t.id)
      .slice(0, MAX_BATCH);
    const customIds = batch
      .filter((t) => t.kind === "custom")
      .map((t) => t.id)
      .slice(0, MAX_BATCH);

    (async () => {
      const next = new Map<string, RecapTriageSummary>();
      const pulls: Promise<void>[] = [];

      const ingest = (
        rows:
          | ReadonlyArray<{
              readonly recapId: string;
              readonly label: string;
              readonly reasons: ReadonlyArray<{
                readonly code: string;
                readonly label: string;
                readonly source: string;
              } | null> | null;
            } | null>
          | null
          | undefined,
      ) => {
        for (const row of rows ?? []) {
          if (!row?.recapId) continue;
          const reasons: RecapTriageReason[] = [];
          for (const r of row.reasons ?? []) {
            if (!r?.code || !r.label || !r.source) continue;
            reasons.push({ code: r.code, label: r.label, source: r.source });
          }
          next.set(String(row.recapId), {
            label: parseRecapTriageLabel(row.label),
            reasons,
          });
        }
      };

      if (legacyIds.length > 0) {
        pulls.push(
          fetchQuery<RecapReviewTriageQueryType>(
            environment,
            RecapReviewTriageQuery,
            { recapIds: legacyIds, isCustom: false },
          )
            .toPromise()
            .then((data) => ingest(data?.recapReviewTriage))
            .catch(() => {
              /* quiet fail — leave unresolved; never invent Clean */
            }),
        );
      }
      if (customIds.length > 0) {
        pulls.push(
          fetchQuery<RecapReviewTriageQueryType>(
            environment,
            RecapReviewTriageQuery,
            { recapIds: customIds, isCustom: true },
          )
            .toPromise()
            .then((data) => ingest(data?.recapReviewTriage))
            .catch(() => {
              /* quiet fail — leave unresolved */
            }),
        );
      }
      await Promise.all(pulls);
      if (cancelled) return;
      setById(next);
      setSettled(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, environment, signature]);

  return { byId, settled };
}
