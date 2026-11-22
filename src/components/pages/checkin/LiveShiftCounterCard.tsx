import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Template } from "./checkinTypes";
import { card, h2, helperText, input, secondaryBtn } from "./checkinStyles";
import type { StorageLike } from "./offlineClock";
import {
  hasLiveCounterActivity,
  liveCounterTotals,
  readLiveShiftCounter,
  resolveActiveCounterSkus,
  writeLiveShiftCounter,
  type LiveShiftCounterState,
  type LiveShiftQuote,
} from "./liveShiftCounter";
import { getSpeechRecognition } from "./voiceDraft";

export interface LiveShiftCounterCardProps {
  code: string;
  token: string;
  template?: Template | null;
  accent: string;
  storage?: StorageLike;
  onActivityChange?: (hasActivity: boolean) => void;
}

const stepperBtnBase: CSSProperties = {
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  borderRadius: 11,
  border: "1px solid rgba(28, 25, 23, 0.16)",
  background: "#faf7f1",
  color: "#1c1917",
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  touchAction: "manipulation",
  userSelect: "none",
};

const countDisplayStyle: CSSProperties = {
  minWidth: 34,
  textAlign: "center",
  fontSize: 16,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "#1c1917",
};

function formatQuoteTime(savedAt: number): string {
  if (!savedAt) return "";
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function LiveShiftCounterCard({
  code,
  token,
  template,
  accent,
  storage,
  onActivityChange,
}: LiveShiftCounterCardProps) {
  const [state, setState] = useState<LiveShiftCounterState>(() =>
    readLiveShiftCounter(code, token, storage),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [skuFilter, setSkuFilter] = useState("");
  const [quoteDraft, setQuoteDraft] = useState("");
  const [dictating, setDictating] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const loaded = readLiveShiftCounter(code, token, storage);
    setState(loaded);
    onActivityChange?.(hasLiveCounterActivity(loaded));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token, storage]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    [],
  );

  const commit = (
    updater: (prev: LiveShiftCounterState) => Omit<LiveShiftCounterState, "v" | "updatedAt">,
  ) => {
    setState((prev) => {
      const next = writeLiveShiftCounter(
        code,
        token,
        {
          ...(prev.lastSynced ? { lastSynced: prev.lastSynced } : {}),
          ...updater(prev),
        },
        storage,
      );
      onActivityChange?.(hasLiveCounterActivity(next));
      return next;
    });
  };

  const skus = useMemo(() => resolveActiveCounterSkus(template), [template]);
  const totals = useMemo(() => liveCounterTotals(state), [state]);

  const filteredSkus = useMemo(() => {
    const q = skuFilter.trim().toLowerCase();
    const list = q
      ? skus.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.category ?? "").toLowerCase().includes(q),
        )
      : skus;
    if (q) return list;
    // Pin SKUs with active taps to the top when there are many catalog items.
    if (list.length <= 8) return list;
    return [...list].sort((a, b) => {
      const aActive =
        (state.skus[a.id]?.samples ?? 0) + (state.skus[a.id]?.sold ?? 0) > 0
          ? 1
          : 0;
      const bActive =
        (state.skus[b.id]?.samples ?? 0) + (state.skus[b.id]?.sold ?? 0) > 0
          ? 1
          : 0;
      return bActive - aActive;
    });
  }, [skus, skuFilter, state.skus]);

  const bumpSku = (skuId: string, field: "samples" | "sold", delta: number) => {
    commit((prev) => {
      const cur = prev.skus[skuId] ?? { samples: 0, sold: 0 };
      const nextVal = Math.max(0, Math.min(99999, cur[field] + delta));
      const nextSkus = {
        ...prev.skus,
        [skuId]: {
          ...cur,
          [field]: nextVal,
        },
      };
      return {
        consumersSampled: prev.consumersSampled,
        skus: nextSkus,
        quotes: prev.quotes,
      };
    });
  };

  const setConsumersSampled = (nextCount: number) => {
    const clamped = Math.max(0, Math.min(99999, Math.round(nextCount) || 0));
    commit((prev) => ({
      consumersSampled: clamped,
      skus: prev.skus,
      quotes: prev.quotes,
    }));
  };

  const addQuote = (rawText?: string) => {
    const text = (rawText ?? quoteDraft).trim();
    if (!text) return;
    const entry: LiveShiftQuote = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      savedAt: Date.now(),
    };
    commit((prev) => ({
      consumersSampled: prev.consumersSampled,
      skus: prev.skus,
      quotes: [...prev.quotes, entry],
    }));
    if (rawText === undefined) {
      setQuoteDraft("");
    }
  };

  const removeQuote = (quoteId: string) => {
    commit((prev) => ({
      consumersSampled: prev.consumersSampled,
      skus: prev.skus,
      quotes: prev.quotes.filter((q) => q.id !== quoteId),
    }));
  };

  const speechCtor = useMemo(() => getSpeechRecognition(), []);

  const toggleDictation = () => {
    if (!speechCtor) return;
    if (dictating) {
      recognitionRef.current?.stop();
      setDictating(false);
      return;
    }
    try {
      const rec = new speechCtor();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (ev) => {
        const chunks: string[] = [];
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          const item = ev.results[i];
          if (item?.[0]?.transcript) chunks.push(item[0].transcript);
        }
        const spoken = chunks.join(" ").trim();
        if (spoken) {
          setQuoteDraft((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
        }
      };
      rec.onerror = () => setDictating(false);
      rec.onend = () => setDictating(false);
      recognitionRef.current = rec;
      setDictating(true);
      rec.start();
    } catch {
      setDictating(false);
    }
  };

  const summaryParts: string[] = [];
  if (totals.totalSamples > 0) summaryParts.push(`${totals.totalSamples} sampled`);
  if (totals.totalSold > 0) summaryParts.push(`${totals.totalSold} sold`);
  if (totals.consumersSampled > 0) {
    summaryParts.push(
      `${totals.consumersSampled} consumer${totals.consumersSampled === 1 ? "" : "s"}`,
    );
  }
  if (totals.quoteCount > 0) {
    summaryParts.push(
      `${totals.quoteCount} quote${totals.quoteCount === 1 ? "" : "s"}`,
    );
  }

  return (
    <section
      style={card}
      aria-label="Live shift counter and quote scratchpad"
      data-testid="live-shift-counter-card"
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                color: "#44403c",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Live shift tally
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(28, 25, 23, 0.06)",
                color: "#44403c",
              }}
            >
              Saved offline
            </span>
          </div>
          <h2 style={{ ...h2, marginTop: 4 }}>Tap counts & quotes as you go</h2>
          {summaryParts.length > 0 ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                fontWeight: 600,
                color: "#1c1917",
                fontVariantNumeric: "tabular-nums",
              }}
              data-testid="live-counter-summary"
            >
              {summaryParts.join(" · ")}
            </p>
          ) : (
            <p style={{ ...helperText, margin: "4px 0 0" }}>
              Count samples, sales, and verbatim quotes at the table — pre-fills your recap when you finish.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          style={{
            border: "1px solid rgba(28, 25, 23, 0.14)",
            background: "#faf7f1",
            color: "#1c1917",
            borderRadius: 10,
            padding: "8px 12px",
            minHeight: 40,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {collapsed ? "Expand" : "Hide"}
        </button>
      </div>

      {!collapsed ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Total Consumers Sampled — kept strictly distinct from total SKU samples */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(28, 25, 23, 0.1)",
              background: "#faf7f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>
                Total consumers sampled
              </div>
              <div style={{ fontSize: 12, color: "#44403c", marginTop: 2 }}>
                Distinct people who tasted today
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                aria-label="Decrease total consumers sampled"
                disabled={state.consumersSampled <= 0}
                onClick={() => setConsumersSampled(state.consumersSampled - 1)}
                style={{
                  ...stepperBtnBase,
                  background: "#fff",
                  opacity: state.consumersSampled <= 0 ? 0.4 : 1,
                }}
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                aria-label="Total consumers sampled"
                value={state.consumersSampled === 0 ? "0" : String(state.consumersSampled)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  setConsumersSampled(raw ? Number(raw) : 0);
                }}
                style={{
                  width: 64,
                  height: 44,
                  textAlign: "center",
                  fontSize: 17,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  borderRadius: 10,
                  border: "1px solid rgba(28, 25, 23, 0.16)",
                  background: "#fff",
                  color: "#1c1917",
                  padding: "0 6px",
                }}
              />
              <button
                type="button"
                aria-label="Increase total consumers sampled"
                onClick={() => setConsumersSampled(state.consumersSampled + 1)}
                style={{
                  ...stepperBtnBase,
                  background: accent,
                  borderColor: "rgba(10, 13, 9, 0.14)",
                  color: "#0a0d09",
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Per-SKU Samples / Sold tappers */}
          {skus.length > 0 ? (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>
                  Active SKUs ({skus.length})
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#44403c",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  Samples: <strong>{totals.totalSamples}</strong> · Sold:{" "}
                  <strong>{totals.totalSold}</strong>
                </span>
              </div>

              {skus.length > 8 ? (
                <input
                  type="search"
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  placeholder="Filter SKUs…"
                  aria-label="Filter SKUs"
                  style={{ ...input, marginTop: 0, marginBottom: 10, minHeight: 42, padding: "9px 12px", fontSize: 14 }}
                />
              ) : null}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: skus.length > 8 ? 340 : undefined,
                  overflowY: skus.length > 8 ? "auto" : undefined,
                }}
              >
                {filteredSkus.map((sku) => {
                  const counts = state.skus[sku.id] ?? { samples: 0, sold: 0 };
                  const active = counts.samples > 0 || counts.sold > 0;
                  return (
                    <div
                      key={sku.id}
                      data-testid={`live-sku-row-${sku.id}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 13,
                        border: active
                          ? "1px solid rgba(28, 25, 23, 0.24)"
                          : "1px solid rgba(28, 25, 23, 0.09)",
                        background: active ? "#fff" : "rgba(250, 247, 241, 0.55)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#1c1917",
                          lineHeight: 1.3,
                          marginBottom: 8,
                        }}
                      >
                        {sku.name}
                        {sku.category ? (
                          <span
                            style={{
                              fontWeight: 500,
                              fontSize: 12,
                              color: "#57534e",
                              marginLeft: 6,
                            }}
                          >
                            · {sku.category}
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 10,
                        }}
                      >
                        {/* Samples stepper */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 4,
                            padding: "4px 6px",
                            borderRadius: 10,
                            background: "#faf7f1",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#44403c",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              paddingLeft: 2,
                            }}
                          >
                            Samples
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <button
                              type="button"
                              aria-label={`Decrease samples for ${sku.name}`}
                              disabled={counts.samples <= 0}
                              onClick={() => bumpSku(sku.id, "samples", -1)}
                              style={{
                                ...stepperBtnBase,
                                width: 40,
                                minWidth: 40,
                                background: "#fff",
                                opacity: counts.samples <= 0 ? 0.38 : 1,
                              }}
                            >
                              −
                            </button>
                            <span
                              style={countDisplayStyle}
                              data-testid={`sku-samples-${sku.id}`}
                            >
                              {counts.samples}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase samples for ${sku.name}`}
                              onClick={() => bumpSku(sku.id, "samples", 1)}
                              style={{
                                ...stepperBtnBase,
                                width: 40,
                                minWidth: 40,
                                background: accent,
                                borderColor: "rgba(10, 13, 9, 0.14)",
                                color: "#0a0d09",
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Sold stepper */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 4,
                            padding: "4px 6px",
                            borderRadius: 10,
                            background: "#faf7f1",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#44403c",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              paddingLeft: 2,
                            }}
                          >
                            Sold
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <button
                              type="button"
                              aria-label={`Decrease sold for ${sku.name}`}
                              disabled={counts.sold <= 0}
                              onClick={() => bumpSku(sku.id, "sold", -1)}
                              style={{
                                ...stepperBtnBase,
                                width: 40,
                                minWidth: 40,
                                background: "#fff",
                                opacity: counts.sold <= 0 ? 0.38 : 1,
                              }}
                            >
                              −
                            </button>
                            <span
                              style={countDisplayStyle}
                              data-testid={`sku-sold-${sku.id}`}
                            >
                              {counts.sold}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase sold for ${sku.name}`}
                              onClick={() => bumpSku(sku.id, "sold", 1)}
                              style={{
                                ...stepperBtnBase,
                                width: 40,
                                minWidth: 40,
                                background: "#fff",
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* 1-Tap Verbatim Consumer Quote Scratchpad */}
          <div
            style={{
              paddingTop: 12,
              borderTop: "1px solid rgba(28, 25, 23, 0.08)",
            }}
          >
            <label
              htmlFor={`quote-scratchpad-${code}`}
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "#1c1917",
              }}
            >
              Consumer quote scratchpad
            </label>
            <p style={{ ...helperText, fontSize: 12, margin: "2px 0 8px" }}>
              Jot down verbatim shopper reactions right when you hear them.
            </p>

            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <input
                id={`quote-scratchpad-${code}`}
                type="text"
                value={quoteDraft}
                onChange={(e) => setQuoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quoteDraft.trim()) {
                    e.preventDefault();
                    addQuote();
                  }
                }}
                placeholder='e.g. "Way crisper than I expected — grabbing a 4-pack!"'
                style={{
                  ...input,
                  marginTop: 0,
                  flex: 1,
                  minHeight: 46,
                  fontSize: 15,
                }}
              />
              {speechCtor ? (
                <button
                  type="button"
                  onClick={toggleDictation}
                  aria-label={dictating ? "Stop voice dictation" : "Dictate quote"}
                  style={{
                    ...secondaryBtn,
                    flex: "0 0 auto",
                    minHeight: 46,
                    padding: "0 12px",
                    fontSize: 13,
                    background: dictating ? "#fef3c7" : "#faf7f1",
                  }}
                >
                  {dictating ? "Stop" : "Mic"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={!quoteDraft.trim()}
                onClick={() => addQuote()}
                style={{
                  flex: "0 0 auto",
                  minHeight: 46,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "none",
                  background: quoteDraft.trim() ? accent : "rgba(28, 25, 23, 0.1)",
                  color: quoteDraft.trim() ? "#0a0d09" : "#78716c",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: quoteDraft.trim() ? "pointer" : "default",
                }}
              >
                + Save
              </button>
            </div>

            {state.quotes.length > 0 ? (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "10px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {state.quotes.map((q) => {
                  const stamped = formatQuoteTime(q.savedAt);
                  return (
                    <li
                      key={q.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: "#faf7f1",
                        border: "1px solid rgba(28, 25, 23, 0.08)",
                        fontSize: 13,
                        color: "#1c1917",
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                        “{q.text}”
                        {stamped ? (
                          <span style={{ color: "#78716c", fontSize: 11, marginLeft: 6 }}>
                            {stamped}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove quote ${q.text}`}
                        onClick={() => removeQuote(q.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#57534e",
                          fontSize: 18,
                          fontWeight: 700,
                          width: 36,
                          height: 36,
                          minWidth: 36,
                          minHeight: 36,
                          borderRadius: 8,
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <p style={{ ...helperText, fontSize: 12, margin: 0 }}>
            Auto-fills your recap when you file or clock out — everything stays editable before submitting.
          </p>
        </div>
      ) : null}
    </section>
  );
}
