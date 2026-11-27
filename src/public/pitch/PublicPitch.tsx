import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  LayoutGrid,
  Presentation,
} from "lucide-react";
import PublicDeadLink from "@/public/PublicDeadLink";
import { RecapDocument } from "@/recap/RecapDocument";
import { RecapKpiStrip, type RecapKpiItem } from "@/recap/RecapDetailShell";
import { PhotoLightbox, type PhotoLightboxItem } from "@/shared/PhotoLightbox";
import PitchFootprintMap from "./PitchFootprintMap";
import { downloadBuyerDeckPptx } from "./buyerDeckPptx";
import {
  buildPitchSlidePlan,
  fetchPublicPitchPayload,
  fmtPitchNum,
  fmtPitchPct,
  resolveDeckAccentHex,
  type PitchPayload,
  type PitchSlideDescriptor,
} from "./pitchDeckTypes";

const muted = "var(--recap-muted, #5c6154)";
const ink = "var(--recap-text, #14160f)";
const border = "var(--recap-border, #e2e4d8)";
const okInk = "#2b4c08";
const okBg = "#ebf3e1";
const okBorder = "rgba(43, 76, 8, 0.24)";
const warnInk = "#a8340f";

function sectionLabel(section: string): string {
  if (section === "liked") return "What shoppers loved";
  if (section === "asked") return "Shopper questions";
  if (section === "passed") return "Objections noted";
  return "Shopper feedback";
}

/**
 * Public, no-login Retail Buyer QBR / Line-Review Deck (`/pitch/:token`).
 * Renders a co-branded 6–8 slide interactive web presentation (plus print/scroll
 * view), US choropleth activation footprint map, 2–4 week post-demo POS lift
 * halo, OSA / shelf compliance, AI-distilled shopper voice, curated shelf
 * photos with lightbox, and native `.pptx` + PDF downloads.
 */
const PublicPitch: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PitchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"deck" | "scroll">("deck");
  const [activeSlide, setActiveSlide] = useState(0);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [pptxNotice, setPptxNotice] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "spark-v2");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, []);

  const load = useCallback(
    (code?: string) => {
      if (!token) {
        setLoading(false);
        setError("This link isn't valid. Double-check it or ask for a new one.");
        return;
      }
      setLoading(true);
      fetchPublicPitchPayload(token, code)
        .then(({ status, payload }) => {
          if (!payload) {
            setError(
              "This link isn't valid. Double-check it or ask for a new one.",
            );
            setData(null);
            return;
          }
          if (status === 403 && payload.error === "passcode_required") {
            setError("Incorrect passcode. Try again.");
            setData((prev) => prev ?? { locked: true, requiresPasscode: true });
            return;
          }
          if (status < 200 || status >= 300) {
            setError(
              status === 410
                ? "This Buyer Pitch Deck has expired. Ask for a fresh link."
                : status === 403
                  ? "This Buyer Pitch Deck link has been revoked."
                  : payload.message ||
                    "This link isn't valid. Double-check it or ask for a new one.",
            );
            setData(null);
            return;
          }
          setError(null);
          setData(payload);
          setActiveSlide(0);
        })
        .catch(() => {
          setError(
            "We couldn't reach the server. Check your connection and try again.",
          );
          setData(null);
        })
        .finally(() => {
          setLoading(false);
          setUnlocking(false);
        });
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const css = data?.brand?.cssVariables;
    if (!css || typeof css !== "object") return;
    const root = document.documentElement;
    const applied: string[] = [];
    for (const [key, value] of Object.entries(css)) {
      if (typeof value === "string" && key.startsWith("--")) {
        root.style.setProperty(key, value);
        applied.push(key);
      }
    }
    return () => {
      for (const key of applied) root.style.removeProperty(key);
    };
  }, [data?.brand?.cssVariables]);

  const slides = useMemo(
    () => (data && !data.locked ? buildPitchSlidePlan(data) : []),
    [data],
  );

  useEffect(() => {
    if (viewMode !== "deck" || slides.length <= 1 || lightboxIndex !== null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setActiveSlide((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setActiveSlide((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, slides.length, lightboxIndex]);

  const handleDownloadPptx = async () => {
    if (!data || exportingPptx) return;
    setExportingPptx(true);
    setPptxNotice(null);
    try {
      const count = await downloadBuyerDeckPptx(data);
      setPptxNotice(`Downloaded ${count}-slide PowerPoint (.pptx).`);
      window.setTimeout(() => setPptxNotice(null), 3500);
    } catch {
      setPptxNotice("Could not generate PowerPoint right now. Try Save PDF.");
    } finally {
      setExportingPptx(false);
    }
  };

  if (loading && !data) {
    return (
      <RecapDocument page>
        <main className="recap-doc-body">
          <p style={{ color: muted }}>Loading Buyer Pitch Deck…</p>
        </main>
      </RecapDocument>
    );
  }

  if (error && !data) {
    return (
      <PublicDeadLink
        eyebrow="Buyer Pitch Deck"
        title="This link isn't available"
        message={error}
      />
    );
  }

  const brandDisplayName = data?.brandName || data?.brand?.name || null;

  if (data?.locked || (data?.requiresPasscode && !data.kpis)) {
    return (
      <RecapDocument page brandName={brandDisplayName} status="Buyer deck">
        <main className="recap-doc-body max-w-md mx-auto space-y-4">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: muted }}
          >
            {brandDisplayName || "Brand"} · Buyer Pitch Deck
          </p>
          <h1
            className="display text-2xl font-bold"
            style={{ color: ink, letterSpacing: "-0.025em" }}
          >
            {data.title || "Buyer Pitch Deck"}
          </h1>
          {data.subtitle ? (
            <p style={{ color: muted }}>{data.subtitle}</p>
          ) : null}
          <p className="text-sm" style={{ color: muted }}>
            This deck is passcode-protected. Enter the code from your brand
            contact to view the slides, POS lift halo, and store photos.
          </p>
          {error ? (
            <p className="text-sm font-medium" style={{ color: "#9c2d14" }}>
              {error}
            </p>
          ) : null}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setUnlocking(true);
              load(passcode);
            }}
          >
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
              style={{
                borderColor: border,
                color: ink,
                background: "#ffffff",
              }}
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={unlocking || passcode.trim().length < 4}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{
                background: ink,
                color: "#ffffff",
                border: `1px solid ${ink}`,
              }}
            >
              {unlocking ? "Unlocking…" : "Unlock deck"}
            </button>
          </form>
        </main>
      </RecapDocument>
    );
  }

  if (!data) {
    return (
      <PublicDeadLink
        eyebrow="Buyer Pitch Deck"
        title="This link isn't available"
        message={
          error ||
          "This link isn't valid. Double-check it or ask for a new one."
        }
      />
    );
  }

  const kpis = data.kpis || {};
  const photos = data.photos || [];
  const sellStory = (data.sellStory || data.introNote || "").trim();
  const accentHex = resolveDeckAccentHex(data);
  const scopeLabel = [data.retailerFilter, data.marketFilter]
    .filter(Boolean)
    .join(" · ");
  const periodLabel =
    data.periodStart && data.periodEnd
      ? `${data.periodStart} → ${data.periodEnd}`
      : "";

  const lightbox: PhotoLightboxItem[] = photos.map((p) => {
    const store = (p.store || p.retailer || "").trim();
    const secondary = [store, p.category].filter(Boolean).join(" · ");
    const sellCaption = (p.caption || "").trim();
    let caption = sellCaption;
    if (sellCaption && secondary) {
      const alreadyNamesStore =
        !!store && sellCaption.toLowerCase().includes(store.toLowerCase());
      caption = alreadyNamesStore
        ? sellCaption
        : `${sellCaption} · ${secondary}`;
    } else if (!sellCaption) {
      caption = secondary;
    }
    return {
      url: p.url,
      caption,
      name: store || p.category || undefined,
    };
  });

  const kpiItems: RecapKpiItem[] = [
    { label: "Visits", value: fmtPitchNum(kpis.totalVisits) },
    { label: "Stores activated", value: fmtPitchNum(kpis.storesActivated) },
    {
      label: "Samples handed out",
      value: fmtPitchNum(kpis.totalSamplesDistributed),
    },
    {
      label: "Rep-observed units",
      value: fmtPitchNum(kpis.repObservedUnits),
      glow: true,
    },
    {
      label: "Adjusted register units",
      value: fmtPitchNum(kpis.adjustedRegisterUnits),
    },
    { label: "Sampling lift", value: fmtPitchPct(kpis.samplingLiftPct, true) },
  ];

  if (data.includeCosts) {
    kpiItems.push(
      {
        label: "Supported spend",
        value:
          kpis.totalSupportedCost != null
            ? `$${fmtPitchNum(kpis.totalSupportedCost)}`
            : "—",
      },
      {
        label: "Cost / unit sold",
        value:
          kpis.costPerUnitSold != null
            ? `$${fmtPitchNum(kpis.costPerUnitSold)}`
            : "—",
      },
    );
  }

  const clampedSlide = Math.min(activeSlide, Math.max(0, slides.length - 1));

  const renderSlideCard = (slide: PitchSlideDescriptor, idx: number) => {
    const isHiddenInDeck = viewMode === "deck" && idx !== clampedSlide;
    return (
      <section
        key={slide.id}
        aria-label={slide.title}
        className={`rounded-2xl overflow-hidden transition ${
          isHiddenInDeck ? "hidden print:block" : "block"
        } print:break-after-page`}
        style={{
          background: "#ffffff",
          border: `1px solid ${border}`,
          boxShadow: "0 1px 3px rgba(20,22,15,0.04)",
        }}
      >
        <div className="h-1.5 w-full" style={{ background: accentHex }} />

        <div className="p-6 sm:p-8 space-y-6">
          {slide.id === "cover" ? (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <p
                  className="mono text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: muted }}
                >
                  {brandDisplayName || "Brand"} · Retail Buyer QBR
                  {data.buyerName ? ` · Prepared for ${data.buyerName}` : ""}
                </p>
                <h1
                  className="display text-3xl sm:text-5xl font-bold"
                  style={{
                    color: ink,
                    letterSpacing: "-0.035em",
                    lineHeight: 1.05,
                  }}
                >
                  {data.title || "Buyer Pitch Deck"}
                </h1>
                {data.subtitle ? (
                  <p className="text-lg" style={{ color: muted }}>
                    {data.subtitle}
                  </p>
                ) : null}
                <p className="text-sm tab-num" style={{ color: muted }}>
                  {[periodLabel, scopeLabel].filter(Boolean).join(" · ")}
                </p>
              </div>

              {sellStory ? (
                <div
                  className="rounded-xl p-5"
                  style={{
                    background: "#f8f8f4",
                    border: `1px solid ${border}`,
                    borderLeft: `4px solid ${accentHex}`,
                  }}
                >
                  <p
                    className="text-[15px] sm:text-base leading-relaxed"
                    style={{ color: ink }}
                  >
                    {sellStory}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {[
                  { label: "Visits", value: fmtPitchNum(kpis.totalVisits) },
                  {
                    label: "Stores activated",
                    value: fmtPitchNum(kpis.storesActivated),
                  },
                  {
                    label: "Samples handed out",
                    value: fmtPitchNum(kpis.totalSamplesDistributed),
                  },
                  kpis.samplingLiftPct != null
                    ? {
                        label: "Matched POS lift",
                        value: fmtPitchPct(kpis.samplingLiftPct, true),
                        accent: true,
                      }
                    : {
                        label: "Rep-observed units",
                        value: fmtPitchNum(kpis.repObservedUnits),
                        accent: true,
                      },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl p-4"
                    style={{
                      background: "#fafaf6",
                      border: `1px solid ${border}`,
                    }}
                  >
                    <p
                      className="mono text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: muted }}
                    >
                      {stat.label}
                    </p>
                    <p
                      className="display text-2xl sm:text-3xl font-bold mt-1 tab-num"
                      style={{ color: stat.accent ? okInk : ink }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p
                    className="mono text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: muted }}
                  >
                    {brandDisplayName || "Brand"} · {slide.label}
                  </p>
                  <h2
                    className="display text-2xl font-bold mt-1"
                    style={{ color: ink, letterSpacing: "-0.025em" }}
                  >
                    {slide.title}
                  </h2>
                </div>
                <span
                  className="mono text-[11px] tab-num"
                  style={{ color: muted }}
                >
                  Slide {idx + 1} / {slides.length}
                </span>
              </div>

              {slide.id === "kpis" ? (
                <div className="space-y-6">
                  <RecapKpiStrip items={kpiItems} />
                  {(data.retailerBreakdown || []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr
                            style={{
                              color: muted,
                              borderBottom: `1px solid ${border}`,
                            }}
                          >
                            <th className="py-2 pr-3 font-semibold">
                              Retailer Banner
                            </th>
                            <th className="py-2 px-3 text-right font-semibold">
                              Doors
                            </th>
                            <th className="py-2 px-3 text-right font-semibold">
                              Visits
                            </th>
                            <th className="py-2 px-3 text-right font-semibold">
                              Samples
                            </th>
                            <th className="py-2 px-3 text-right font-semibold">
                              Rep Units
                            </th>
                            <th className="py-2 px-3 text-right font-semibold">
                              Register POS
                            </th>
                            {data.includeCosts ? (
                              <th className="py-2 pl-3 text-right font-semibold">
                                Cost / Unit
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {(data.retailerBreakdown || []).map((row, rIdx) => (
                            <tr
                              key={`${row.retailerBanner}-${rIdx}`}
                              style={{ borderBottom: `1px solid ${border}` }}
                            >
                              <td
                                className="py-2.5 pr-3 font-semibold"
                                style={{ color: ink }}
                              >
                                {row.retailerBanner || "Retailer"}
                              </td>
                              <td className="py-2.5 px-3 text-right tab-num">
                                {fmtPitchNum(row.storesCount)}
                              </td>
                              <td className="py-2.5 px-3 text-right tab-num">
                                {fmtPitchNum(row.visits)}
                              </td>
                              <td className="py-2.5 px-3 text-right tab-num">
                                {fmtPitchNum(row.samplesDistributed)}
                              </td>
                              <td className="py-2.5 px-3 text-right tab-num font-semibold">
                                {fmtPitchNum(row.repObservedUnits)}
                              </td>
                              <td className="py-2.5 px-3 text-right tab-num">
                                {row.adjustedRegisterUnits != null
                                  ? fmtPitchNum(row.adjustedRegisterUnits)
                                  : "—"}
                              </td>
                              {data.includeCosts ? (
                                <td className="py-2.5 pl-3 text-right tab-num">
                                  {row.costPerUnitSold != null
                                    ? `$${row.costPerUnitSold}`
                                    : "—"}
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {slide.id === "footprint" && data.footprint ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div
                    className="lg:col-span-7 rounded-xl p-3"
                    style={{ border: `1px solid ${border}`, background: "#ffffff" }}
                  >
                    <PitchFootprintMap
                      states={data.footprint.states || []}
                      accentHex={accentHex}
                    />
                    <p
                      className="text-xs mt-2 px-1 tab-num"
                      style={{ color: muted }}
                    >
                      {data.footprint.statesCount}{" "}
                      {data.footprint.statesCount === 1 ? "state" : "states"} ·{" "}
                      {data.footprint.marketsCount}{" "}
                      {data.footprint.marketsCount === 1 ? "market" : "markets"}{" "}
                      activated · Hover any shaded state for totals
                    </p>
                  </div>
                  <div className="lg:col-span-5 space-y-3">
                    <p
                      className="mono text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: muted }}
                    >
                      Active states & markets
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr
                            style={{
                              color: muted,
                              borderBottom: `1px solid ${border}`,
                            }}
                          >
                            <th className="py-1.5 pr-2 font-semibold">State</th>
                            <th className="py-1.5 px-2 text-right font-semibold">
                              Doors
                            </th>
                            <th className="py-1.5 px-2 text-right font-semibold">
                              Visits
                            </th>
                            <th className="py-1.5 px-2 text-right font-semibold">
                              Samples
                            </th>
                            <th className="py-1.5 pl-2 text-right font-semibold">
                              Units
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.footprint.states || [])
                            .slice(0, 10)
                            .map((st) => (
                              <tr
                                key={st.state}
                                style={{ borderBottom: `1px solid ${border}` }}
                              >
                                <td
                                  className="py-2 pr-2 font-semibold"
                                  style={{ color: ink }}
                                >
                                  {st.state}
                                </td>
                                <td className="py-2 px-2 text-right tab-num">
                                  {fmtPitchNum(st.stores)}
                                </td>
                                <td className="py-2 px-2 text-right tab-num">
                                  {fmtPitchNum(st.visits)}
                                </td>
                                <td className="py-2 px-2 text-right tab-num">
                                  {fmtPitchNum(st.samples)}
                                </td>
                                <td className="py-2 pl-2 text-right tab-num font-semibold">
                                  {fmtPitchNum(st.registerUnits ?? st.repUnits)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {slide.id === "halo" ? (
                data.posHalo?.available && data.posHalo.weeks.length > 0 ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        {
                          label: "Pre-demo baseline",
                          value:
                            data.posHalo.baselineAvgUnits != null
                              ? `${data.posHalo.baselineAvgUnits} u/wk`
                              : "—",
                        },
                        {
                          label: "Demo week lift",
                          value: fmtPitchPct(data.posHalo.demoWeekLiftPct, true),
                          highlight: true,
                        },
                        {
                          label: "2–4 wk post-demo halo",
                          value: fmtPitchPct(data.posHalo.postDemoHaloPct, true),
                          highlight: true,
                        },
                        {
                          label: "Matched POS doors",
                          value: fmtPitchNum(data.posHalo.matchedStores),
                        },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className="rounded-xl p-3.5"
                          style={{
                            border: `1px solid ${border}`,
                            background: "#fafaf6",
                          }}
                        >
                          <p
                            className="mono text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: muted }}
                          >
                            {m.label}
                          </p>
                          <p
                            className="display text-xl sm:text-2xl font-bold mt-1 tab-num"
                            style={{ color: m.highlight ? okInk : ink }}
                          >
                            {m.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div
                      className="rounded-xl p-5 space-y-4"
                      style={{
                        border: `1px solid ${border}`,
                        background: "#fafaf6",
                      }}
                    >
                      <p className="text-xs font-medium" style={{ color: muted }}>
                        Average matched register units per store-SKU-week
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end min-h-[190px] pt-4">
                        {(() => {
                          const maxVal = Math.max(
                            1,
                            ...data.posHalo.weeks.map((w) => w.avgUnits),
                          );
                          return data.posHalo.weeks.map((w) => {
                            const pct = Math.max(
                              10,
                              Math.round((w.avgUnits / maxVal) * 140),
                            );
                            const isDemoOrPost = w.offset >= 0;
                            return (
                              <div
                                key={w.offset}
                                className="flex flex-col items-center gap-1.5"
                              >
                                {isDemoOrPost && w.liftPct != null ? (
                                  <span
                                    className="text-[11px] font-semibold px-1.5 py-0.5 rounded tab-num"
                                    style={{
                                      background:
                                        w.liftPct >= 0 ? okBg : "#f3f4ef",
                                      color: w.liftPct >= 0 ? okInk : muted,
                                    }}
                                  >
                                    {fmtPitchPct(w.liftPct, true)}
                                  </span>
                                ) : (
                                  <span className="text-[11px]" style={{ color: muted }}>
                                    Base
                                  </span>
                                )}
                                <span
                                  className="text-xs font-bold tab-num"
                                  style={{ color: ink }}
                                >
                                  {w.avgUnits}
                                </span>
                                <div
                                  className="w-full max-w-[68px] rounded-t-lg transition-all"
                                  style={{
                                    height: pct,
                                    background: isDemoOrPost
                                      ? accentHex
                                      : "#c8ccbe",
                                  }}
                                />
                                <span
                                  className="text-[11px] font-medium text-center leading-tight"
                                  style={{ color: ink }}
                                >
                                  {w.label}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      {data.posHalo.note ? (
                        <p className="text-xs" style={{ color: muted }}>
                          {data.posHalo.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className="rounded-xl p-5 space-y-3"
                      style={{
                        border: `1px solid ${border}`,
                        background: "#fafaf6",
                      }}
                    >
                      <p className="text-xs font-medium" style={{ color: muted }}>
                        Top activated doors — units sold vs samples distributed
                      </p>
                      {(() => {
                        const top = (data.topStoreWins || []).slice(0, 6);
                        const maxU = Math.max(
                          1,
                          ...top.map((r) =>
                            Number(
                              r.adjustedRegisterUnits ?? r.repObservedUnits ?? 0,
                            ),
                          ),
                        );
                        return (
                          <div className="space-y-2.5">
                            {top.map((r, rIdx) => {
                              const units = Number(
                                r.adjustedRegisterUnits ??
                                  r.repObservedUnits ??
                                  0,
                              );
                              const widthPct = Math.max(
                                6,
                                Math.round((units / maxU) * 100),
                              );
                              return (
                                <div
                                  key={`${r.storeLabel}-${rIdx}`}
                                  className="space-y-1"
                                >
                                  <div className="flex items-center justify-between text-xs gap-2">
                                    <span
                                      className="font-semibold truncate"
                                      style={{ color: ink }}
                                    >
                                      {r.storeLabel || "Store"}
                                    </span>
                                    <span
                                      className="tab-num shrink-0"
                                      style={{ color: muted }}
                                    >
                                      <strong style={{ color: ink }}>
                                        {fmtPitchNum(units)}
                                      </strong>{" "}
                                      units · {fmtPitchNum(r.samplesDistributed)}{" "}
                                      samples
                                    </span>
                                  </div>
                                  <div
                                    className="h-2.5 w-full rounded-full overflow-hidden"
                                    style={{ background: "#e8eae1" }}
                                  >
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${widthPct}%`,
                                        background: accentHex,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-xs" style={{ color: muted }}>
                      {data.posHalo?.note ||
                        "Connect retailer POS sales feeds to unlock 2–4 week post-demo register velocity halo alongside rep-observed velocity."}
                    </p>
                  </div>
                )
              ) : null}

              {slide.id === "shelf" && data.shelfCompliance ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        label: "On-Shelf Availability (OSA)",
                        value: fmtPitchPct(data.shelfCompliance.osaRatePct),
                        pct: data.shelfCompliance.osaRatePct ?? 0,
                        detail: `${data.shelfCompliance.onShelfCount} of ${data.shelfCompliance.auditedVisits} audited visits confirmed on shelf`,
                        ok: (data.shelfCompliance.osaRatePct ?? 0) >= 85,
                      },
                      {
                        label: "Price Tag Compliance",
                        value: fmtPitchPct(data.shelfCompliance.priceTagRatePct),
                        pct: data.shelfCompliance.priceTagRatePct ?? 0,
                        detail: `${data.shelfCompliance.priceTagVisibleCount} of ${data.shelfCompliance.auditedVisits} audited visits with legible shelf price tag`,
                        ok: (data.shelfCompliance.priceTagRatePct ?? 0) >= 80,
                      },
                    ].map((meter) => (
                      <div
                        key={meter.label}
                        className="rounded-xl p-5 space-y-3"
                        style={{
                          border: `1px solid ${border}`,
                          background: "#fafaf6",
                        }}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p
                            className="mono text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: muted }}
                          >
                            {meter.label}
                          </p>
                          <span
                            className="display text-3xl font-bold tab-num"
                            style={{ color: meter.ok ? okInk : warnInk }}
                          >
                            {meter.value}
                          </span>
                        </div>
                        <div
                          className="h-3 w-full rounded-full overflow-hidden"
                          style={{ background: "#e5e7dd" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, meter.pct))}%`,
                              background: meter.ok ? okInk : warnInk,
                            }}
                          />
                        </div>
                        <p className="text-xs" style={{ color: muted }}>
                          {meter.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Audited visits",
                        value: fmtPitchNum(data.shelfCompliance.auditedVisits),
                      },
                      {
                        label: "Avg facings",
                        value:
                          data.shelfCompliance.avgFacings != null
                            ? String(data.shelfCompliance.avgFacings)
                            : "—",
                      },
                      {
                        label: "Median shelf price",
                        value: data.shelfCompliance.medianPrice
                          ? `$${data.shelfCompliance.medianPrice}`
                          : "—",
                      },
                      {
                        label: "OOS gaps flagged",
                        value: fmtPitchNum(data.shelfCompliance.oosGapsFlagged),
                      },
                    ].map((cell) => (
                      <div
                        key={cell.label}
                        className="rounded-xl p-4"
                        style={{
                          border: `1px solid ${border}`,
                          background: "#ffffff",
                        }}
                      >
                        <p
                          className="mono text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: muted }}
                        >
                          {cell.label}
                        </p>
                        <p
                          className="display text-2xl font-bold mt-1 tab-num"
                          style={{ color: ink }}
                        >
                          {cell.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {slide.id === "stores" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(data.topStoreWins || []).map((row, i) => (
                    <div
                      key={`${row.storeLabel}-${i}`}
                      className="rounded-xl p-4 space-y-1.5"
                      style={{
                        border: `1px solid ${border}`,
                        background: "#fafaf6",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm" style={{ color: ink }}>
                          {String(row.storeLabel || "Store")}
                        </p>
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 tab-num"
                          style={{
                            background: "#ffffff",
                            color: muted,
                            border: `1px solid ${border}`,
                          }}
                        >
                          {fmtPitchNum(row.visits)}{" "}
                          {Number(row.visits) === 1 ? "visit" : "visits"}
                        </span>
                      </div>
                      {[row.retailerBanner, row.market].filter(Boolean).length >
                      0 ? (
                        <p className="text-xs" style={{ color: muted }}>
                          {[row.retailerBanner, row.market]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      <p
                        className="text-xs pt-0.5 tab-num font-medium"
                        style={{ color: ink }}
                      >
                        {fmtPitchNum(row.samplesDistributed)} samples ·{" "}
                        {fmtPitchNum(row.repObservedUnits)} rep units
                        {row.adjustedRegisterUnits != null
                          ? ` · ${fmtPitchNum(row.adjustedRegisterUnits)} register`
                          : ""}
                      </p>
                      {row.highlight ? (
                        <p
                          className="text-xs pt-1 leading-snug"
                          style={{ color: muted }}
                        >
                          {String(row.highlight)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {slide.id === "voice" && data.shopperVoice ? (
                <div className="space-y-4">
                  {data.shopperVoice.themes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.shopperVoice.themes.map((t, tIdx) => (
                        <span
                          key={`${t.label}-${tIdx}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            background: t.section === "liked" ? okBg : "#f4f5ef",
                            color: t.section === "liked" ? okInk : ink,
                            border: `1px solid ${
                              t.section === "liked" ? okBorder : border
                            }`,
                          }}
                        >
                          <span>{t.label}</span>
                          {t.recapCount > 0 ? (
                            <span className="tab-num opacity-75">
                              · {t.recapCount}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(data.shopperVoice.quotes.length > 0
                      ? data.shopperVoice.quotes
                      : data.shopperVoice.themes
                          .filter((t) => t.quote)
                          .map((t) => ({
                            section: t.section,
                            label: t.label,
                            quote: t.quote || "",
                          }))
                    )
                      .slice(0, 6)
                      .map((q, qIdx) => (
                        <blockquote
                          key={`${q.label}-${qIdx}`}
                          className="rounded-xl p-4 space-y-2 m-0"
                          style={{
                            border: `1px solid ${border}`,
                            background: "#fafaf6",
                            borderLeft: `3px solid ${
                              q.section === "liked" ? okInk : accentHex
                            }`,
                          }}
                        >
                          <p
                            className="mono text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                              color: q.section === "liked" ? okInk : muted,
                            }}
                          >
                            {q.label || sectionLabel(q.section)}
                          </p>
                          <p
                            className="text-sm leading-relaxed"
                            style={{ color: ink }}
                          >
                            “{q.quote}”
                          </p>
                        </blockquote>
                      ))}
                  </div>
                  <p className="text-xs tab-num" style={{ color: muted }}>
                    Synthesized from {fmtPitchNum(data.shopperVoice.commentCount)}{" "}
                    verified shopper comments across{" "}
                    {fmtPitchNum(data.shopperVoice.recapCount)} approved recaps.
                  </p>
                </div>
              ) : null}

              {slide.id.startsWith("photos-") && "photos" in slide ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slide.photos.map((p) => {
                    const globalIdx = photos.findIndex(
                      (all) =>
                        (p.id && all.id === p.id) || all.url === p.url,
                    );
                    return (
                      <button
                        key={p.id || p.url}
                        type="button"
                        className="rounded-xl overflow-hidden text-left transition hover:opacity-95 cursor-pointer"
                        style={{
                          border: `1px solid ${border}`,
                          background: "#ffffff",
                        }}
                        onClick={() =>
                          setLightboxIndex(globalIdx >= 0 ? globalIdx : 0)
                        }
                      >
                        <img
                          src={p.url}
                          alt={p.caption || p.store || "Demo photo"}
                          className="w-full aspect-[4/3] object-cover"
                          loading="lazy"
                        />
                        <div className="p-2.5 space-y-0.5">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: ink }}
                          >
                            {p.store || p.retailer || "Store"}
                          </p>
                          {p.caption ? (
                            <p
                              className="text-[11px] leading-snug"
                              style={{ color: ink }}
                            >
                              {p.caption}
                            </p>
                          ) : null}
                          <p
                            className="text-[11px] tab-num"
                            style={{ color: muted }}
                          >
                            {[p.market, p.eventDate].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <RecapDocument
      page
      brandName={brandDisplayName}
      status="Buyer QBR Deck"
      actions={
        <div className="no-print print:hidden flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ background: "#eeefe8", border: `1px solid ${border}` }}
            role="group"
            aria-label="Deck view mode"
          >
            <button
              type="button"
              onClick={() => setViewMode("deck")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer"
              style={{
                background: viewMode === "deck" ? "#ffffff" : "transparent",
                color: viewMode === "deck" ? ink : muted,
              }}
            >
              <Presentation size={13} strokeWidth={1.8} />
              Deck
            </button>
            <button
              type="button"
              onClick={() => setViewMode("scroll")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer"
              style={{
                background: viewMode === "scroll" ? "#ffffff" : "transparent",
                color: viewMode === "scroll" ? ink : muted,
              }}
            >
              <LayoutGrid size={13} strokeWidth={1.8} />
              All slides
            </button>
          </div>
          <button
            type="button"
            disabled={exportingPptx}
            onClick={() => void handleDownloadPptx()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
            style={{
              background: ink,
              color: "#ffffff",
              border: `1px solid ${ink}`,
            }}
          >
            <Download size={13} strokeWidth={1.85} />
            {exportingPptx ? "Building .pptx…" : "Download .pptx"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-85 cursor-pointer"
            style={{
              border: `1px solid ${border}`,
              background: "#ffffff",
              color: ink,
            }}
          >
            <FileDown size={13} strokeWidth={1.85} />
            Save PDF
          </button>
        </div>
      }
    >
      <main className="recap-doc-body space-y-5">
        {pptxNotice ? (
          <div
            role="status"
            className="no-print print:hidden rounded-lg px-3.5 py-2 text-xs font-medium"
            style={{
              background: okBg,
              color: okInk,
              border: `1px solid ${okBorder}`,
            }}
          >
            {pptxNotice}
          </div>
        ) : null}

        {viewMode === "deck" && slides.length > 1 ? (
          <nav
            aria-label="Slide navigation"
            className="no-print print:hidden flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2"
            style={{ background: "#ffffff", border: `1px solid ${border}` }}
          >
            <div className="flex flex-wrap items-center gap-1">
              {slides.map((s, idx) => {
                const active = idx === clampedSlide;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => setActiveSlide(idx)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer"
                    style={{
                      background: active ? ink : "transparent",
                      color: active ? "#ffffff" : muted,
                    }}
                  >
                    {idx + 1}. {s.label}
                  </button>
                );
              })}
            </div>
            <div className="inline-flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label="Previous slide"
                disabled={clampedSlide <= 0}
                onClick={() => setActiveSlide((i) => Math.max(0, i - 1))}
                className="p-1.5 rounded-md disabled:opacity-35 cursor-pointer"
                style={{ border: `1px solid ${border}`, color: ink }}
              >
                <ChevronLeft size={14} />
              </button>
              <span
                className="mono text-[11px] px-1.5 tab-num"
                style={{ color: muted }}
              >
                {clampedSlide + 1} / {slides.length}
              </span>
              <button
                type="button"
                aria-label="Next slide"
                disabled={clampedSlide >= slides.length - 1}
                onClick={() =>
                  setActiveSlide((i) => Math.min(slides.length - 1, i + 1))
                }
                className="p-1.5 rounded-md disabled:opacity-35 cursor-pointer"
                style={{ border: `1px solid ${border}`, color: ink }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </nav>
        ) : null}

        <div className="space-y-6">
          {slides.map((slide, idx) => renderSlideCard(slide, idx))}
        </div>

        {lightboxIndex !== null && lightbox[lightboxIndex] && (
          <PhotoLightbox
            photos={lightbox}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onStep={setLightboxIndex}
          />
        )}
      </main>
    </RecapDocument>
  );
};

export default PublicPitch;
