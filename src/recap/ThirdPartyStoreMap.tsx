import { useEffect, useRef, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { MapCustomRecapStoreMutation } from "@/api/mutations/MapCustomRecapStoreMutation";
import type { MapCustomRecapStoreMutation as MapCustomRecapStoreMutationType } from "@/api/mutations/__generated__/MapCustomRecapStoreMutation.graphql";
import { SuggestCustomRecapStoreMutation } from "@/api/mutations/SuggestCustomRecapStoreMutation";
import type { SuggestCustomRecapStoreMutation as SuggestCustomRecapStoreMutationType } from "@/api/mutations/__generated__/SuggestCustomRecapStoreMutation.graphql";
import { RetailersSearchQuery } from "@/api/queries/RetailersSearchQuery";
import type { RetailersSearchQuery as RetailersSearchQueryType } from "@/api/queries/__generated__/RetailersSearchQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

type Suggestion = {
  uuid?: string;
  name?: string;
  address?: string;
  kind?: string;
  isNational?: boolean;
  score?: number;
  confidence?: string;
  reason?: string;
  source?: string;
};

function asSuggestions(raw: unknown): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is Suggestion => Boolean(row && typeof row === "object"));
}

function confidenceOf(hit: Suggestion): "high" | "medium" | "low" {
  const c = (hit.confidence || "").toLowerCase();
  if (c === "high" || c === "medium" || c === "low") return c;
  const score = Number(hit.score || 0);
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function confidenceLabel(level: "high" | "medium" | "low"): string {
  if (level === "high") return "High confidence";
  if (level === "medium") return "Medium confidence";
  return "Low confidence";
}

function needsAiRefresh(hits: Suggestion[]): boolean {
  if (hits.length === 0) return true;
  const top = hits[0];
  return confidenceOf(top) !== "high";
}

export function ThirdPartyStoreMap({
  recapId,
  typedName,
  typedAddress,
  status,
  suggestions,
  mappedRetailerName,
}: {
  recapId: string;
  typedName: string;
  typedAddress: string;
  status: string;
  suggestions: unknown;
  mappedRetailerName?: string | null;
}) {
  const tenantId = useAuthStore((s) => s.tenantId);
  const showAlert = useAlertStore((s) => s.showAlert);
  const [q, setQ] = useState("");
  const [liveSuggestions, setLiveSuggestions] = useState(() => asSuggestions(suggestions));
  const [suggesting, setSuggesting] = useState(false);
  const askedRef = useRef(false);
  const [commit, busy] = useMutation<MapCustomRecapStoreMutationType>(
    MapCustomRecapStoreMutation,
  );
  const [commitSuggest] = useMutation<SuggestCustomRecapStoreMutationType>(
    SuggestCustomRecapStoreMutation,
  );
  const search = q.trim();
  const data = useLazyLoadQuery<RetailersSearchQueryType>(
    RetailersSearchQuery,
    {
      q: search || null,
      first: 12,
      filters: tenantId ? { tenantId } : null,
    },
    { fetchPolicy: search.length >= 2 ? "store-or-network" : "store-or-network" },
  );

  const hits = liveSuggestions;
  const mapped = status === "mapped";
  const topHit = !mapped && hits.length > 0 ? hits[0] : null;
  const topConfidence = topHit ? confidenceOf(topHit) : null;
  const highConfidence =
    topHit && topConfidence === "high" && topHit.uuid ? topHit : null;
  const maybeHits = highConfidence
    ? hits.filter((h) => h.uuid !== highConfidence.uuid)
    : hits;

  useEffect(() => {
    setLiveSuggestions(asSuggestions(suggestions));
  }, [suggestions]);

  useEffect(() => {
    if (mapped || askedRef.current) return;
    if (!needsAiRefresh(asSuggestions(suggestions))) return;
    askedRef.current = true;
    setSuggesting(true);
    commitSuggest({
      variables: { input: { id: recapId } },
      onCompleted: (res) => {
        setSuggesting(false);
        const payload = res.suggestCustomRecapStore;
        if (!payload?.success) {
          // Soft fail — staff can still search manually.
          return;
        }
        const next = asSuggestions(payload.customRecap?.storeSuggestions);
        if (next.length) setLiveSuggestions(next);
      },
      onError: () => setSuggesting(false),
    });
  }, [mapped, suggestions, recapId, commitSuggest]);

  const mapTo = (retailerId: string) => {
    commit({
      variables: { input: { id: recapId, retailerId } },
      onCompleted: (res) => {
        if (res.mapCustomRecapStore?.success) {
          showAlert("Store mapped.", "success");
          return;
        }
        showAlert(res.mapCustomRecapStore?.message || "Couldn't map that store.", "error");
      },
      onError: () => showAlert("Couldn't map that store.", "error"),
    });
  };

  const retailers = (data.retailers?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  return (
    <div className="spark-card p-5">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="font-bold">Map this store</h3>
        {mapped ? (
          <span className="chip chip-lime">Mapped</span>
        ) : (
          <span className="chip chip-orange">Needs a match</span>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--spark-text-secondary)" }}>
        They typed this. Confirm a maybe-match or pick the national / regional
        chain. The recap already landed.
      </p>
      <p className="text-sm font-semibold">{typedName || "—"}</p>
      <p className="text-sm mb-4" style={{ color: "var(--spark-text-meta)" }}>
        {typedAddress || "—"}
      </p>
      {mapped && mappedRetailerName ? (
        <p className="text-sm mb-3">
          Mapped to <strong>{mappedRetailerName}</strong>
        </p>
      ) : null}

      {!mapped && suggesting ? (
        <p className="text-sm mb-3" style={{ color: "var(--spark-text-meta)" }}>
          Looking up a suggested chain…
        </p>
      ) : null}

      {!mapped && highConfidence ? (
        <div
          className="rounded-xl px-3 py-3 mb-4"
          style={{
            border: "1px solid var(--spark-border)",
            background: "rgba(var(--spark-ink-rgb),0.04)",
          }}
        >
          <p
            className="mono text-[10px] mb-2"
            style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
          >
            SUGGESTED MATCH
          </p>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <span className="font-semibold text-sm">{highConfidence.name}</span>
              {highConfidence.isNational ? (
                <span className="chip chip-purple chip-sm ml-2">National</span>
              ) : highConfidence.kind === "chain" ? (
                <span className="chip chip-muted chip-sm ml-2">Regional</span>
              ) : (
                <span className="chip chip-muted chip-sm ml-2">Store</span>
              )}
              <span className="chip chip-muted chip-sm ml-2">
                {confidenceLabel("high")}
              </span>
              <span
                className="block text-xs mt-1"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {highConfidence.reason}
                {highConfidence.address ? ` · ${highConfidence.address}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={busy || !highConfidence.uuid}
                onClick={() => highConfidence.uuid && mapTo(highConfidence.uuid)}
                className="px-3 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                Confirm {highConfidence.name}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!mapped && maybeHits.length > 0 ? (
        <div className="space-y-2 mb-4">
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
          >
            {highConfidence ? "OR PICK A DIFFERENT MATCH" : "MAYBE A MATCH"}
          </p>
          {maybeHits.map((hit) => {
            const level = confidenceOf(hit);
            return (
              <button
                key={hit.uuid || hit.name}
                type="button"
                disabled={busy || !hit.uuid}
                onClick={() => hit.uuid && mapTo(hit.uuid)}
                className="w-full text-left rounded-xl px-3 py-2"
                style={{
                  border: "1px solid var(--spark-border)",
                  background: "rgba(var(--spark-ink-rgb),0.04)",
                }}
              >
                <span className="font-semibold text-sm">{hit.name}</span>
                {hit.isNational ? (
                  <span className="chip chip-purple chip-sm ml-2">National</span>
                ) : hit.kind === "chain" ? (
                  <span className="chip chip-muted chip-sm ml-2">Regional</span>
                ) : (
                  <span className="chip chip-muted chip-sm ml-2">Store</span>
                )}
                <span className="chip chip-muted chip-sm ml-2">
                  {confidenceLabel(level)}
                </span>
                <span className="block text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
                  {hit.reason}
                  {hit.address ? ` · ${hit.address}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!mapped ? (
        <div>
          <label className="mono text-[10px]" style={{ letterSpacing: "0.14em" }}>
            PICK A CHAIN OR STORE
          </label>
          <input
            className="spark-input w-full mt-1 mb-2"
            placeholder="Search Total Wine, regional account…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {search.length >= 2
            ? retailers.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={busy}
                  onClick={() => mapTo(r.uuid)}
                  className="w-full text-left rounded-xl px-3 py-2 mb-1"
                  style={{
                    border: "1px solid var(--spark-border)",
                    background: "rgba(var(--spark-ink-rgb),0.04)",
                  }}
                >
                  <span className="text-sm font-semibold">{r.name}</span>
                  {r.isNational ? (
                    <span className="chip chip-purple chip-sm ml-2">National</span>
                  ) : null}
                  {r.address ? (
                    <span
                      className="block text-xs mt-1"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {r.address}
                    </span>
                  ) : null}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
