import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
/** A scoring pass that takes longer than this is treated as failed so the
 *  toolbar never sits on "Scoring Clean…" forever. */
const SETTLE_TIMEOUT_MS = 20_000;

/**
 * Staff-only batched Clean / Needs Eyes labels for the Needs-review page.
 * Pass the unfiltered review set (not the Clean/Needs Eyes-filtered list).
 * Quiet-fails to an empty map — callers must treat missing ids as unresolved,
 * never as Clean. Never call with isClient — the resolver refuses brand users.
 */
export function useRecapReviewTriage(
  targets: readonly FlagTarget[],
  enabled: boolean,
): {
  byId: Map<string, RecapTriageSummary>;
  settled: boolean;
  /** The last pass errored or timed out; labels may be missing. */
  failed: boolean;
  /** Run the scoring pass again for the same targets. */
  retry: () => void;
} {
  const environment = useRelayEnvironment();
  const [byId, setById] = useState<Map<string, RecapTriageSummary>>(
    () => new Map(),
  );
  // False only while the latest request is in flight. A finished request,
  // including a quiet failure, is settled so the toolbar can drop
  // "Scoring Clean…".
  const [settled, setSettled] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const signature = useMemo(() => {
    if (!enabled) return "";
    return targets
      .slice(0, MAX_BATCH * 2)
      .map((t) => `${t.kind}:${t.id}`)
      .join("|");
  }, [enabled, targets]);
  const lastSig = useRef("");
  // Targets ride in a ref so a new array with the same ids (every parent
  // re-render) does not re-run the effect. It used to: the re-run cancelled
  // the in-flight pass, then bailed on the unchanged signature, so the
  // cancelled pass never marked itself settled and the toolbar was stuck
  // on "Scoring Clean…".
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  useEffect(() => {
    if (!enabled || !signature) {
      setById(new Map());
      setSettled(true);
      setFailed(false);
      lastSig.current = "";
      return;
    }
    const sigKey = `${signature}#${attempt}`;
    if (sigKey === lastSig.current) return;
    lastSig.current = sigKey;
    setSettled(false);
    setFailed(false);

    let cancelled = false;
    let anyFailed = false;
    const targets = targetsRef.current;
    const legacyIds = targets
      .filter((t) => t.kind === "legacy")
      .map((t) => t.id)
      .slice(0, MAX_BATCH);
    const customIds = targets
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
              readonly why?: string | null;
              readonly whySource?: string | null;
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
            why: row.why ?? null,
            whySource: row.whySource ?? "",
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
              anyFailed = true;
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
              anyFailed = true;
            }),
        );
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = await Promise.race([
        Promise.all(pulls).then(() => false),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(true), SETTLE_TIMEOUT_MS);
        }),
      ]);
      if (timer) clearTimeout(timer);
      if (!cancelled) {
        setById(next);
        setSettled(true);
        setFailed(anyFailed || timedOut);
      }
    })();

    return () => {
      cancelled = true;
      // Let a re-run with the same signature start a fresh pass instead of
      // bailing while nothing is in flight.
      lastSig.current = "";
    };
  }, [enabled, environment, signature, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { byId, settled, failed, retry };
}
