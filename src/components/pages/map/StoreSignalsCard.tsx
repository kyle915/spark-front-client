import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  buildStoreSignalMailto,
  isOosOrReorderSignal,
  type StoreSignalFilterKind,
  type StoreSignalRow,
} from "./storeSignals";

interface StoreSignalsCardProps {
  signals: ReadonlyArray<StoreSignalRow>;
  brandName?: string | null;
  selectedWaveKeys: ReadonlySet<string>;
  onToggleWaveKey?: (sig: StoreSignalRow) => void;
}

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;

export const StoreSignalsCard: React.FC<StoreSignalsCardProps> = ({
  signals,
  brandName,
  selectedWaveKeys,
  onToggleWaveKey,
}) => {
  const [tab, setTab] = useState<StoreSignalFilterKind>("all");

  const oosCount = useMemo(
    () => signals.filter(isOosOrReorderSignal).length,
    [signals],
  );
  const promoCount = useMemo(
    () => signals.filter((s) => Boolean(s.competitorPromo.trim())).length,
    [signals],
  );

  const visible = useMemo(() => {
    if (tab === "oos_reorder") return signals.filter(isOosOrReorderSignal);
    if (tab === "promo") return signals.filter((s) => Boolean(s.competitorPromo.trim()));
    return signals;
  }, [signals, tab]);

  if (signals.length === 0) return null;

  return (
    <section className="spark-card p-5 space-y-4" aria-label="Field store signals">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-base" style={TEXT}>
            Field store signals
            <span className="text-xs font-normal ml-2" style={META}>
              {signals.length.toLocaleString("en-US")}{" "}
              {signals.length === 1 ? "store" : "stores"} · last 90 days
            </span>
          </h3>
          <p className="text-xs mt-0.5" style={META}>
            Out-of-stock alerts, buyer reorder leads, and competitor promos extracted automatically from recap notes.
          </p>
        </div>

        <div className="pill-group" role="group" aria-label="Signal type filter">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`pill-btn ${tab === "all" ? "on" : ""}`}
          >
            All ({signals.length})
          </button>
          {oosCount > 0 && (
            <button
              type="button"
              onClick={() => setTab("oos_reorder")}
              className={`pill-btn ${tab === "oos_reorder" ? "on" : ""}`}
            >
              OOS &amp; Reorder ({oosCount})
            </button>
          )}
          {promoCount > 0 && (
            <button
              type="button"
              onClick={() => setTab("promo")}
              className={`pill-btn ${tab === "promo" ? "on" : ""}`}
            >
              Competitor promos ({promoCount})
            </button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-[var(--spark-border)]">
        {visible.slice(0, 12).map((sig) => {
          const inWave = Boolean(sig.storeKey && selectedWaveKeys.has(sig.storeKey));
          const place = [sig.city, sig.stateCode].filter(Boolean).join(", ");
          const rebookParams = new URLSearchParams({
            venue: sig.storeName,
            ...(sig.address ? { address: sig.address } : {}),
            ...(sig.stateCode ? { state: sig.stateCode } : {}),
          });
          return (
            <li
              key={`${sig.storeKey || sig.storeName}:${sig.recapUuid}`}
              className="py-3.5 first:pt-1 last:pb-0 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm" style={TEXT}>
                    {sig.storeName}
                  </span>
                  {place ? (
                    <span className="text-xs" style={META}>
                      {place}
                    </span>
                  ) : null}
                  {sig.eventDate ? (
                    <span className="mono text-[11px]" style={META}>
                      · {sig.eventDate}
                    </span>
                  ) : null}
                  {sig.stockoutRisk ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        color: "var(--spark-flag-ink)",
                        background: "rgba(239, 90, 42, 0.1)",
                        border: "1px solid rgba(239, 90, 42, 0.3)",
                      }}
                    >
                      Out-of-stock risk
                    </span>
                  ) : null}
                  {sig.reorderOpportunity ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        color: "var(--spark-text)",
                        background: "rgba(var(--spark-ink-rgb), 0.06)",
                        border: "1px solid var(--spark-border)",
                      }}
                    >
                      Reorder lead
                    </span>
                  ) : null}
                  {sig.managerContact ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        color: "var(--spark-text-secondary)",
                        border: "1px solid var(--spark-border)",
                      }}
                    >
                      {sig.managerContact}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1 text-xs" style={{ color: "var(--spark-text-secondary)" }}>
                  {sig.stockoutRisk ? <p>• {sig.stockoutRisk}</p> : null}
                  {sig.reorderOpportunity && sig.reorderOpportunity !== sig.stockoutRisk ? (
                    <p>• {sig.reorderOpportunity}</p>
                  ) : null}
                  {sig.managerNote &&
                  sig.managerNote !== sig.reorderOpportunity &&
                  sig.managerNote !== sig.stockoutRisk ? (
                    <p>• {sig.managerNote}</p>
                  ) : null}
                  {sig.competitorPromo ? (
                    <p>
                      • Competitor promo
                      {sig.competitorBrand ? ` (${sig.competitorBrand})` : ""}: {sig.competitorPromo}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={buildStoreSignalMailto(sig, brandName)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                  style={{
                    background: "var(--spark-lime)",
                    color: "var(--spark-on-accent)",
                  }}
                >
                  Draft RMM / distributor email →
                </a>
                {sig.storeKey && onToggleWaveKey ? (
                  <button
                    type="button"
                    onClick={() => onToggleWaveKey(sig)}
                    className="spark-btn-ghost text-xs !px-2.5 !py-1.5"
                  >
                    {inWave ? "In wave ✓" : "+ Wave"}
                  </button>
                ) : null}
                <Link
                  to={`/requests/create?${rebookParams.toString()}`}
                  className="spark-btn-ghost text-xs !px-2.5 !py-1.5"
                >
                  Schedule demo
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default StoreSignalsCard;
