/**
 * Interactive Self-Serve Sandbox ("Explore Sample Brand" at `/sandbox`).
 *
 * Read-only, zero-login CPG beverage brand workspace ("Solstice Botanical
 * Sparkling") letting prospective founders test Program Reports, StoreSheet,
 * Shelf & Voice (with live MSRP drift), Photo Wall (with PhotoLightbox),
 * Buyer QBR Decks (with live 16:9 `.pptx` download), Saved Views, and
 * grounded Ask Spark Q&A without touching any live tenant data.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bookmark,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  MapPin,
  Presentation,
  Search,
  Send,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { SparkMark } from "@/recap/SparkMark";
import { PhotoLightbox, type PhotoLightboxItem } from "@/shared/PhotoLightbox";
import { PitchFootprintMap } from "@/public/pitch/PitchFootprintMap";
import { downloadBuyerDeckPptx } from "@/public/pitch/buyerDeckPptx";
import { trendBadgeMeta } from "@/components/pages/reports/shelfVoiceHelpers";
import {
  answerSandboxQuestion,
  buildSandboxPitchPayload,
  computeSandboxMsrpDrift,
  fetchSandboxBrand,
  filterSandboxStores,
  SANDBOX_SUGGESTED_QUESTIONS,
  type SandboxAskAnswer,
  type SandboxPayload,
  type SandboxStore,
} from "./sandboxHelpers";

type SandboxTab = "program" | "stores" | "shelf" | "photos" | "deck";

const CARD = {
  background: "#ffffff",
  border: "1px solid #dcddd5",
} as const;
const SOFT = {
  background: "#f1f2ec",
  border: "1px solid #dcddd5",
} as const;
const INK = { color: "#14160f" } as const;
const META = { color: "#5c6154" } as const;
const OK_PILL = {
  background: "#ebf3e1",
  color: "#2b4c08",
  border: "1px solid #c5dca8",
} as const;
const WARN_PILL = {
  background: "#fff1ec",
  color: "#a8340f",
  border: "1px solid #f4c6b5",
} as const;

const TABS: ReadonlyArray<{
  id: SandboxTab;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "program", label: "Program Report", icon: <BarChart3 size={14} /> },
  { id: "stores", label: "Stores & StoreSheet", icon: <Store size={14} /> },
  { id: "shelf", label: "Shelf & Voice", icon: <Tag size={14} /> },
  { id: "photos", label: "Photo Wall", icon: <Camera size={14} /> },
  { id: "deck", label: "Buyer QBR Deck", icon: <Presentation size={14} /> },
];

export const SandboxBrandPage: React.FC = () => {
  const [payload, setPayload] = useState<SandboxPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<SandboxTab>("program");
  const [retailerFilter, setRetailerFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [shelfFilter, setShelfFilter] = useState<
    "all" | "attention" | "oos" | "missing_tag" | "price_drift"
  >("all");
  const [msrpInput, setMsrpInput] = useState("");
  const [photoFilter, setPhotoFilter] = useState<
    "all" | "oos" | "missing_tag" | "on_shelf"
  >("all");
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(
    null,
  );
  const [selectedStore, setSelectedStore] = useState<SandboxStore | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloadingPptx, setDownloadingPptx] = useState(false);

  // Ask Spark Sandbox drawer state
  const [askOpen, setAskOpen] = useState(false);
  const [askInput, setAskInput] = useState("");
  const [askHistory, setAskHistory] = useState<
    Array<{ question: string; answer: SandboxAskAnswer }>
  >([]);

  useEffect(() => {
    let active = true;
    fetchSandboxBrand()
      .then((data) => {
        if (!active) return;
        setPayload(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : "Could not load sample brand.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedStore(null);
        setAskOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const targetMsrp = useMemo(() => {
    const cleaned = msrpInput.replace(/[$,\s]/g, "").trim();
    if (cleaned) {
      const n = Number.parseFloat(cleaned);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const def = Number.parseFloat(payload?.brand.targetMsrp ?? "2.49");
    return Number.isFinite(def) ? def : 2.49;
  }, [msrpInput, payload?.brand.targetMsrp]);

  const retailers = useMemo(() => {
    const seen = new Set<string>();
    for (const s of payload?.stores ?? []) seen.add(s.retailerBanner);
    return Array.from(seen).sort();
  }, [payload?.stores]);

  const filteredStores = useMemo(
    () =>
      filterSandboxStores(payload?.stores ?? [], {
        retailerFilter,
        marketFilter,
        shelfFilter,
        targetMsrp,
        query: storeQuery,
      }),
    [payload?.stores, retailerFilter, marketFilter, shelfFilter, targetMsrp, storeQuery],
  );

  const visiblePhotos = useMemo(() => {
    const all = payload?.shelfPhotos ?? [];
    if (photoFilter === "oos") {
      return all.filter(
        (p) => p.productOnShelf === "no" || p.outOfStockGap === "yes",
      );
    }
    if (photoFilter === "missing_tag") {
      return all.filter((p) => p.priceTagVisible === "no");
    }
    if (photoFilter === "on_shelf") {
      return all.filter((p) => p.productOnShelf === "yes");
    }
    return all;
  }, [payload?.shelfPhotos, photoFilter]);

  const lightboxItems = useMemo<PhotoLightboxItem[]>(
    () =>
      visiblePhotos.map((p) => ({
        url: p.photoUrl,
        thumb: p.photoUrl,
        name: p.storeName,
        caption: [
          p.storeName,
          p.market,
          p.eventDate,
          p.bucketName,
          p.price ? `$${p.price}` : "Missing price tag",
        ].join(" · "),
      })),
    [visiblePhotos],
  );

  const pitchData = useMemo(
    () => (payload ? buildSandboxPitchPayload(payload) : null),
    [payload],
  );

  const runAskQuestion = (rawQ: string) => {
    const q = rawQ.trim();
    if (!q || !payload) return;
    const answer = answerSandboxQuestion(payload, q);
    setAskHistory((prev) => [{ question: q, answer }, ...prev]);
    setAskInput("");
    setAskOpen(true);
  };

  const applySavedView = (viewId: string) => {
    const sv = payload?.savedViews.find((v) => v.id === viewId);
    if (!sv) return;
    setActiveSavedViewId(sv.id);
    setRetailerFilter(sv.retailerFilter || "");
    setMarketFilter(sv.marketFilter || "");
    if (sv.storeFilter === "attention") {
      setShelfFilter("attention");
      setTab("shelf");
    } else {
      setShelfFilter("all");
    }
  };

  const handleDownloadPptx = async () => {
    if (!pitchData || downloadingPptx) return;
    setDownloadingPptx(true);
    try {
      await downloadBuyerDeckPptx(pitchData);
    } finally {
      setDownloadingPptx(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "#f6f6f2", color: "#14160f" }}
      >
        <div className="text-center space-y-2">
          <p className="mono text-xs uppercase tracking-widest" style={META}>
            Loading Sample Brand Sandbox…
          </p>
          <p className="display text-lg font-semibold">
            Solstice Botanical Sparkling
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "#f6f6f2", color: "#14160f" }}
      >
        <div className="rounded-xl p-6 max-w-md w-full space-y-3" style={CARD}>
          <p className="display text-lg font-bold">Sample Sandbox unavailable</p>
          <p className="text-sm" style={META}>
            {loadError || "Unable to load sample brand data right now."}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg text-xs font-semibold no-underline"
              style={{ background: "#14160f", color: "#ffffff" }}
            >
              Sign in
            </Link>
            <Link
              to="/onboarding"
              className="px-4 py-2 rounded-lg text-xs font-semibold no-underline"
              style={SOFT}
            >
              Start free workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f6f6f2", color: "#14160f" }}>
      {/* Top Sandbox Banner */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{ background: "#14160f", color: "#f6f6f2", borderColor: "#2a2d22" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <SparkMark height={18} onDark />
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mono shrink-0"
              style={{ background: "#2b4c08", color: "#eef6e3" }}
            >
              Read-Only Sandbox
            </span>
            <span className="text-xs truncate" style={{ color: "#d4d6cc" }}>
              Exploring sample beverage brand{" "}
              <strong style={{ color: "#ffffff" }}>{payload.brand.name}</strong>{" "}
              · Zero risk to live data
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                background: "#26291f",
                color: "#ffffff",
                border: "1px solid #3c4033",
              }}
            >
              <Sparkles size={13} />
              Ask Spark
            </button>
            <Link
              to="/onboarding"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 no-underline"
              style={{ background: "#f6f6f2", color: "#14160f" }}
            >
              Start free workspace
              <ArrowRight size={13} />
            </Link>
            <Link
              to="/login"
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium no-underline"
              style={{ color: "#d4d6cc" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Brand Workspace Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="mono text-[11px] uppercase tracking-wider" style={META}>
              {payload.brand.category} · {payload.brand.periodStart} →{" "}
              {payload.brand.periodEnd}
            </p>
            <h1
              className="display text-2xl sm:text-3xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              {payload.brand.name}
            </h1>
            <p className="text-xs sm:text-sm" style={META}>
              {payload.brand.tagline} · Click any store to inspect StoreSheet,
              adjust Target MSRP, or export the Buyer QBR Deck.
            </p>
          </div>

          {/* Saved Views Quick-Apply Strip */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[11px] font-medium inline-flex items-center gap-1 mr-1"
              style={META}
            >
              <Bookmark size={12} /> Saved views:
            </span>
            {payload.savedViews.map((sv) => {
              const active = activeSavedViewId === sv.id;
              return (
                <button
                  key={sv.id}
                  type="button"
                  onClick={() => applySavedView(sv.id)}
                  title={sv.schedule}
                  className="px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors"
                  style={
                    active
                      ? { background: "#14160f", color: "#ffffff" }
                      : {
                          background: "#ffffff",
                          color: "#14160f",
                          border: "1px solid #dcddd5",
                        }
                  }
                >
                  {sv.name}
                </button>
              );
            })}
            {(retailerFilter || marketFilter || shelfFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setActiveSavedViewId(null);
                  setRetailerFilter("");
                  setMarketFilter("");
                  setShelfFilter("all");
                  setStoreQuery("");
                }}
                className="px-2 py-1 rounded-full text-xs cursor-pointer"
                style={META}
              >
                Reset
              </button>
            )}
          </div>
        </header>

        {/* Studio Hub Tab Strip */}
        <nav
          aria-label="Sandbox workspace sections"
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                style={
                  active
                    ? { background: "#14160f", color: "#ffffff" }
                    : {
                        background: "#ffffff",
                        color: "#3f4437",
                        border: "1px solid #dcddd5",
                      }
                }
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* TAB 1: PROGRAM REPORT */}
        {tab === "program" && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  label: "Activations",
                  value: String(payload.kpis.activations),
                  sub: `${payload.kpis.activeDoors} doors · ${payload.kpis.markets} markets`,
                },
                {
                  label: "Sampled",
                  value: payload.kpis.consumersSampled.toLocaleString(),
                  sub: `$${payload.kpis.avgCostPerSample.toFixed(2)} / sample`,
                },
                {
                  label: "Units Sold",
                  value: payload.kpis.unitsSold.toLocaleString(),
                  sub: "Demo-day register & rep",
                },
                {
                  label: "Conversion",
                  value: `${payload.kpis.conversionPct}%`,
                  sub: "Units ÷ sampled shoppers",
                },
                {
                  label: "POS Velocity Lift",
                  value: `+${payload.kpis.posLiftPct}%`,
                  sub: "Adjusted 4-week halo",
                  ok: true,
                },
                {
                  label: "On-Shelf (OSA)",
                  value: `${payload.kpis.osaRatePct}%`,
                  sub: `${payload.kpis.oosGapsCount} OOS · ${payload.kpis.missingTagCount} missing tags`,
                },
              ].map((k) => (
                <div key={k.label} className="rounded-xl p-4 space-y-1" style={CARD}>
                  <p className="text-[11px] font-medium" style={META}>
                    {k.label}
                  </p>
                  <p
                    className="display text-2xl font-bold tab-num"
                    style={k.ok ? { color: "#2b4c08" } : INK}
                  >
                    {k.value}
                  </p>
                  <p className="text-[11px] tab-num" style={META}>
                    {k.sub}
                  </p>
                </div>
              ))}
            </section>

            {/* Footprint + Top Doors */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <section className="lg:col-span-7 rounded-xl p-5 space-y-3" style={CARD}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="display text-base font-bold">
                      National Activation Footprint
                    </h2>
                    <p className="text-xs" style={META}>
                      Hover any active state to inspect visits, samples, and
                      units sold.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("deck")}
                    className="text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    style={{ color: "#2b4c08" }}
                  >
                    Open Buyer QBR Deck <ArrowRight size={13} />
                  </button>
                </div>
                {pitchData?.footprint ? (
                  <PitchFootprintMap states={pitchData.footprint.states} />
                ) : null}
              </section>

              <section className="lg:col-span-5 rounded-xl p-5 space-y-3" style={CARD}>
                <div>
                  <h2 className="display text-base font-bold">
                    Shopper Voice Highlights
                  </h2>
                  <p className="text-xs" style={META}>
                    Themes distilled from approved in-store shopper comments.
                  </p>
                </div>
                <div className="space-y-3">
                  {payload.shopperThemes.map((t) => (
                    <div
                      key={t.theme}
                      className="rounded-xl p-3.5 space-y-1.5"
                      style={SOFT}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{t.theme}</span>
                        <span className="mono text-[11px] tab-num" style={META}>
                          {t.mentions} mentions
                        </span>
                      </div>
                      <p className="text-xs italic" style={META}>
                        “{t.quote}”
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAskOpen(true)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ background: "#14160f", color: "#ffffff" }}
                >
                  <Sparkles size={13} />
                  Ask Spark a question about Solstice
                </button>
              </section>
            </div>

            {/* Store Performance Preview */}
            <section className="rounded-xl p-5 space-y-3" style={CARD}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="display text-base font-bold">
                    Store Performance Leaderboard ({filteredStores.length})
                  </h2>
                  <p className="text-xs" style={META}>
                    Click any store row to inspect its StoreSheet drawer.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter by retailer"
                    value={retailerFilter}
                    onChange={(e) => setRetailerFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs"
                    style={CARD}
                  >
                    <option value="">All retailers</option>
                    {retailers.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setTab("stores")}
                    className="text-xs font-semibold cursor-pointer"
                    style={{ color: "#2b4c08" }}
                  >
                    View all doors →
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr
                      className="text-left"
                      style={{ color: "#5c6154", borderBottom: "1px solid #dcddd5" }}
                    >
                      <th className="py-2 pr-3 font-medium">Store</th>
                      <th className="py-2 px-2 font-medium">Market</th>
                      <th className="py-2 px-2 text-right font-medium">Sampled</th>
                      <th className="py-2 px-2 text-right font-medium">Units</th>
                      <th className="py-2 px-2 text-right font-medium">Conv.</th>
                      <th className="py-2 px-2 text-right font-medium">POS Lift</th>
                      <th className="py-2 pl-2 text-right font-medium">OSA %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.map((s) => (
                      <tr
                        key={s.storeKey}
                        onClick={() => setSelectedStore(s)}
                        className="cursor-pointer hover:bg-[#f6f6f2] transition-colors"
                        style={{ borderBottom: "1px solid #ecece6" }}
                      >
                        <td className="py-2.5 pr-3 font-semibold">
                          <span className="inline-flex items-center gap-1">
                            {s.storeName}
                            <ExternalLink size={11} style={META} />
                          </span>
                        </td>
                        <td className="py-2.5 px-2" style={META}>
                          {s.market}
                        </td>
                        <td className="py-2.5 px-2 text-right tab-num">
                          {s.consumersSampled}
                        </td>
                        <td className="py-2.5 px-2 text-right tab-num font-semibold">
                          {s.unitsSold}
                        </td>
                        <td className="py-2.5 px-2 text-right tab-num">
                          {s.conversionPct}%
                        </td>
                        <td
                          className="py-2.5 px-2 text-right tab-num font-semibold"
                          style={{ color: "#2b4c08" }}
                        >
                          +{s.posLiftPct}%
                        </td>
                        <td className="py-2.5 pl-2 text-right tab-num">
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={s.osaRatePct >= 85 ? OK_PILL : WARN_PILL}
                          >
                            {s.osaRatePct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: STORES & STORESHEET */}
        {tab === "stores" && (
          <section className="rounded-xl p-5 space-y-4" style={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="display text-lg font-bold">
                  Retail Door Directory & StoreSheet ({filteredStores.length})
                </h2>
                <p className="text-xs" style={META}>
                  Click any door to slide open its StoreSheet with shopper
                  quotes, shelf audit history, and velocity lift.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex items-center">
                  <Search
                    size={13}
                    className="absolute left-2.5 pointer-events-none"
                    style={META}
                  />
                  <input
                    type="search"
                    value={storeQuery}
                    onChange={(e) => setStoreQuery(e.target.value)}
                    placeholder="Search store, market, SKU…"
                    className="pl-8 pr-3 py-1.5 rounded-lg text-xs"
                    style={CARD}
                  />
                </label>
                <select
                  aria-label="Filter stores by retailer"
                  value={retailerFilter}
                  onChange={(e) => setRetailerFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg text-xs"
                  style={CARD}
                >
                  <option value="">All retailers</option>
                  {retailers.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredStores.map((s) => {
                const drift = computeSandboxMsrpDrift(s.latestPrice, targetMsrp);
                return (
                  <button
                    key={s.storeKey}
                    type="button"
                    onClick={() => setSelectedStore(s)}
                    className="text-left rounded-xl p-4 space-y-2.5 cursor-pointer hover:border-[#14160f] transition-colors"
                    style={SOFT}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{s.storeName}</p>
                        <p className="text-xs inline-flex items-center gap-1 mt-0.5" style={META}>
                          <MapPin size={11} />
                          {s.market} · {s.visits} visits
                        </p>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={s.osaRatePct >= 85 ? OK_PILL : WARN_PILL}
                      >
                        OSA {s.osaRatePct}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                      <div>
                        <span className="block text-[10px]" style={META}>
                          Conversion
                        </span>
                        <strong className="tab-num">{s.conversionPct}%</strong>
                      </div>
                      <div>
                        <span className="block text-[10px]" style={META}>
                          POS Lift
                        </span>
                        <strong className="tab-num" style={{ color: "#2b4c08" }}>
                          +{s.posLiftPct}%
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[10px]" style={META}>
                          Price
                        </span>
                        <strong className="tab-num">
                          ${s.latestPrice}
                          {drift?.isDrift ? (
                            <span style={{ color: "#a8340f" }}>
                              {" "}
                              ({drift.deltaPct > 0 ? "+" : ""}
                              {drift.deltaPct}%)
                            </span>
                          ) : null}
                        </strong>
                      </div>
                    </div>

                    {s.stockoutSignal ? (
                      <p
                        className="text-[11px] rounded-lg px-2.5 py-1.5"
                        style={WARN_PILL}
                      >
                        {s.stockoutSignal}
                      </p>
                    ) : (
                      <p className="text-[11px] truncate" style={META}>
                        Top SKU: {s.topSku} · {s.latestFacings} facings
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: SHELF & VOICE */}
        {tab === "shelf" && (
          <div className="space-y-6">
            {/* MSRP Target + Compliance Header */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-xl p-4 space-y-1.5" style={CARD}>
                <span className="text-xs font-medium" style={META}>
                  On-Shelf Availability (OSA)
                </span>
                <p className="display text-3xl font-bold tab-num">
                  {payload.kpis.osaRatePct}%
                </p>
                <p className="text-xs" style={META}>
                  {payload.kpis.oosGapsCount} OOS gaps flagged in window
                </p>
              </div>
              <div className="rounded-xl p-4 space-y-1.5" style={CARD}>
                <span className="text-xs font-medium" style={META}>
                  Price Tag Compliance
                </span>
                <p className="display text-3xl font-bold tab-num">
                  {payload.kpis.priceTagRatePct}%
                </p>
                <p className="text-xs" style={META}>
                  {payload.kpis.missingTagCount} visits missing visible tag
                </p>
              </div>
              <div className="rounded-xl p-4 space-y-1.5" style={CARD}>
                <span className="text-xs font-medium" style={META}>
                  Avg Front Facings
                </span>
                <p className="display text-3xl font-bold tab-num">
                  {payload.kpis.avgFacings}
                </p>
                <p className="text-xs" style={META}>
                  Across {payload.stores.length} audited doors
                </p>
              </div>
              <div className="rounded-xl p-4 space-y-2" style={CARD}>
                <span className="text-xs font-medium" style={META}>
                  Observed Median & Target MSRP
                </span>
                <p className="display text-2xl font-bold tab-num">
                  ${payload.kpis.medianPrice}
                </p>
                <label className="flex items-center gap-1.5 text-xs">
                  <span style={META}>Target MSRP $</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={msrpInput}
                    onChange={(e) => setMsrpInput(e.target.value)}
                    placeholder={payload.brand.targetMsrp}
                    aria-label="Sandbox target MSRP in dollars"
                    className="w-20 px-2 py-1 rounded-md text-xs tab-num"
                    style={CARD}
                  />
                </label>
              </div>
            </section>

            {/* Filterable Compliance Table */}
            <section className="rounded-xl p-5 space-y-4" style={CARD}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="display text-base font-bold">
                    Store Shelf Compliance & MSRP Drift (±5% from $
                    {targetMsrp.toFixed(2)})
                  </h2>
                  <p className="text-xs" style={META}>
                    Type a different Target MSRP above to see drift alerts
                    recalculate live.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ["all", "All doors"],
                      ["attention", "Needs attention"],
                      ["oos", "OOS / Gaps"],
                      ["missing_tag", "Missing tag"],
                      ["price_drift", "MSRP drift"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setShelfFilter(id)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer"
                      style={
                        shelfFilter === id
                          ? { background: "#14160f", color: "#ffffff" }
                          : SOFT
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr
                      className="text-left"
                      style={{ color: "#5c6154", borderBottom: "1px solid #dcddd5" }}
                    >
                      <th className="py-2 pr-3 font-medium">Store</th>
                      <th className="py-2 px-2 font-medium">Status</th>
                      <th className="py-2 px-2 text-right font-medium">Facings</th>
                      <th className="py-2 px-2 text-right font-medium">Observed $</th>
                      <th className="py-2 px-2 font-medium">Drift vs MSRP</th>
                      <th className="py-2 pl-2 font-medium">Field Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.map((s) => {
                      const drift = computeSandboxMsrpDrift(
                        s.latestPrice,
                        targetMsrp,
                      );
                      return (
                        <tr
                          key={s.storeKey}
                          onClick={() => setSelectedStore(s)}
                          className="cursor-pointer hover:bg-[#f6f6f2]"
                          style={{ borderBottom: "1px solid #ecece6" }}
                        >
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold">{s.storeName}</p>
                            <p className="text-[11px]" style={META}>
                              {s.market}
                            </p>
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={
                                s.latestStatus === "on_shelf"
                                  ? OK_PILL
                                  : WARN_PILL
                              }
                            >
                              {s.latestStatus === "on_shelf"
                                ? "On shelf"
                                : "Not found"}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right tab-num">
                            {s.latestFacings}
                          </td>
                          <td className="py-2.5 px-2 text-right tab-num font-semibold">
                            ${s.latestPrice}
                          </td>
                          <td className="py-2.5 px-2 tab-num">
                            {drift ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={drift.isDrift ? WARN_PILL : OK_PILL}
                              >
                                {drift.deltaPct > 0 ? "+" : ""}
                                {drift.deltaPct}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 pl-2">
                            <div className="flex flex-wrap gap-1">
                              {s.missingTagVisits > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={WARN_PILL}
                                >
                                  Missing tag ({s.missingTagVisits})
                                </span>
                              )}
                              {s.oosGapVisits > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={WARN_PILL}
                                >
                                  OOS gap ({s.oosGapVisits})
                                </span>
                              )}
                              {s.competitorPromo && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px]"
                                  style={SOFT}
                                >
                                  {s.competitorPromo}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Before & After Shelf Proof + Competitor Voice by Market */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="rounded-xl p-5 space-y-3" style={CARD}>
                <h2 className="display text-base font-bold">
                  Before & After Shelf Proof
                </h2>
                <div className="space-y-4">
                  {payload.beforeAfterPairs.map((pair) => (
                    <div
                      key={pair.storeKey}
                      className="rounded-xl p-3 space-y-2.5"
                      style={SOFT}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">
                          {pair.storeName}
                        </span>
                        <span className="text-[11px]" style={META}>
                          {pair.market}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { label: "Before", p: pair.beforePhoto },
                          { label: "After", p: pair.afterPhoto },
                        ].map(({ label, p }) => (
                          <div key={p.fileId} className="space-y-1">
                            <img
                              src={p.photoUrl}
                              alt={`${label} shelf at ${pair.storeName}`}
                              className="w-full rounded-lg border"
                              style={{ borderColor: "#dcddd5" }}
                            />
                            <p className="text-[11px] tab-num" style={META}>
                              <strong>{label}:</strong> {p.eventDate} ·{" "}
                              {p.facings ?? "—"} facings
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl p-5 space-y-3" style={CARD}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} style={META} />
                  <h2 className="display text-base font-bold">
                    Rising Competitor Mentions by Market
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {payload.competitorMarkets.map((c) => {
                    const badge = trendBadgeMeta(c.trend);
                    const storeObj = payload.stores.find(
                      (s) => s.storeKey === c.sampleStoreKey,
                    );
                    return (
                      <div
                        key={`${c.market}-${c.competitorBrand}`}
                        className="rounded-xl p-3.5 space-y-1.5"
                        style={SOFT}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">
                              {c.competitorBrand}
                            </span>
                            <span className="text-xs" style={META}>
                              {c.market}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="mono text-xs font-semibold tab-num">
                              {c.mentionCount} mentions
                            </span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs italic" style={META}>
                          “{c.sampleQuote}”
                        </p>
                        {storeObj ? (
                          <button
                            type="button"
                            onClick={() => setSelectedStore(storeObj)}
                            className="text-[11px] font-semibold cursor-pointer"
                            style={{ color: "#2b4c08" }}
                          >
                            Inspect {storeObj.storeName} →
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* TAB 4: PHOTO WALL */}
        {tab === "photos" && (
          <section className="rounded-xl p-5 space-y-4" style={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="display text-lg font-bold">
                  Curated Field & Shelf Photo Wall ({visiblePhotos.length})
                </h2>
                <p className="text-xs" style={META}>
                  Click any proof card to inspect full-screen in PhotoLightbox.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All photos"],
                    ["oos", "OOS / Gaps"],
                    ["missing_tag", "Missing tag"],
                    ["on_shelf", "On shelf"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPhotoFilter(k)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer"
                    style={
                      photoFilter === k
                        ? { background: "#14160f", color: "#ffffff" }
                        : SOFT
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {visiblePhotos.map((p, idx) => (
                <article
                  key={p.fileId}
                  className="rounded-xl overflow-hidden flex flex-col"
                  style={CARD}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="block w-full cursor-pointer"
                  >
                    <img
                      src={p.photoUrl}
                      alt={`${p.storeName} — ${p.bucketName}`}
                      className="w-full h-auto block"
                    />
                  </button>
                  <div className="p-3 space-y-1">
                    <p className="text-xs font-bold truncate">{p.storeName}</p>
                    <p className="text-[11px]" style={META}>
                      {p.market} · {p.eventDate} · {p.bucketName}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* TAB 5: BUYER QBR DECK */}
        {tab === "deck" && pitchData && (
          <div className="space-y-5">
            <section
              className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
              style={CARD}
            >
              <div>
                <p className="mono text-[11px] uppercase tracking-wider" style={META}>
                  One-Click Retail Buyer QBR / Line-Review Deck
                </p>
                <h2 className="display text-xl font-bold mt-0.5">
                  {pitchData.title}
                </h2>
                <p className="text-xs mt-1" style={META}>
                  Export an editable 16:9 PowerPoint (.pptx) with native KPI
                  scorecards, US footprint choropleth, 4-week POS lift halo, and
                  shopper voice quotes.
                </p>
              </div>
              <button
                type="button"
                disabled={downloadingPptx}
                onClick={() => void handleDownloadPptx()}
                className="px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ background: "#14160f", color: "#ffffff" }}
              >
                <Download size={14} />
                {downloadingPptx
                  ? "Building PowerPoint…"
                  : "Download PowerPoint (.pptx)"}
              </button>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Slide Preview 1 */}
              <div className="rounded-xl p-5 space-y-3" style={CARD}>
                <p className="mono text-[10px] uppercase tracking-wider" style={META}>
                  Slide 1 · Executive Story & Footprint
                </p>
                <h3 className="display text-lg font-bold">
                  {payload.brand.name} · Regional Velocity Proof
                </h3>
                <p className="text-xs leading-relaxed" style={META}>
                  {pitchData.sellStory}
                </p>
                {pitchData.footprint ? (
                  <PitchFootprintMap states={pitchData.footprint.states} />
                ) : null}
              </div>

              {/* Slide Preview 2 */}
              <div className="rounded-xl p-5 space-y-4" style={CARD}>
                <p className="mono text-[10px] uppercase tracking-wider" style={META}>
                  Slide 2 · 4-Week POS Lift Halo & Top Store Wins
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg p-3" style={SOFT}>
                    <span className="text-[10px] block" style={META}>
                      Demo Week Lift
                    </span>
                    <strong className="display text-xl tab-num" style={{ color: "#2b4c08" }}>
                      +{pitchData.posHalo?.demoWeekLiftPct}%
                    </strong>
                  </div>
                  <div className="rounded-lg p-3" style={SOFT}>
                    <span className="text-[10px] block" style={META}>
                      Post-Demo Halo
                    </span>
                    <strong className="display text-xl tab-num" style={{ color: "#2b4c08" }}>
                      +{pitchData.posHalo?.postDemoHaloPct}%
                    </strong>
                  </div>
                  <div className="rounded-lg p-3" style={SOFT}>
                    <span className="text-[10px] block" style={META}>
                      Shelf OSA
                    </span>
                    <strong className="display text-xl tab-num">
                      {payload.kpis.osaRatePct}%
                    </strong>
                  </div>
                </div>
                <div className="space-y-2">
                  {(pitchData.topStoreWins ?? []).slice(0, 4).map((w) => (
                    <div
                      key={w.storeLabel}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs"
                      style={SOFT}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{w.storeLabel}</p>
                        <p className="text-[11px]" style={META}>
                          {w.market} · {w.samplesDistributed} sampled ·{" "}
                          {w.repObservedUnits} sold
                        </p>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={OK_PILL}
                      >
                        {w.posCoverageLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* StoreSheet Slide-Over Drawer */}
      {selectedStore && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(20, 22, 15, 0.42)" }}
          onClick={() => setSelectedStore(null)}
        >
          <aside
            role="dialog"
            aria-label={`Store profile for ${selectedStore.storeName}`}
            className="w-full max-w-lg h-full overflow-y-auto p-6 space-y-5"
            style={{ background: "#ffffff", color: "#14160f" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mono text-[10px] uppercase tracking-wider" style={META}>
                  StoreSheet · {selectedStore.retailerBanner}
                </p>
                <h2 className="display text-xl font-bold mt-0.5">
                  {selectedStore.storeName}
                </h2>
                <p className="text-xs mt-0.5" style={META}>
                  {selectedStore.address}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close StoreSheet"
                onClick={() => setSelectedStore(null)}
                className="p-1.5 rounded-lg cursor-pointer"
                style={SOFT}
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="rounded-lg p-3" style={SOFT}>
                <span className="block text-[10px]" style={META}>
                  Conversion
                </span>
                <strong className="display text-lg tab-num">
                  {selectedStore.conversionPct}%
                </strong>
              </div>
              <div className="rounded-lg p-3" style={SOFT}>
                <span className="block text-[10px]" style={META}>
                  POS Lift
                </span>
                <strong className="display text-lg tab-num" style={{ color: "#2b4c08" }}>
                  +{selectedStore.posLiftPct}%
                </strong>
              </div>
              <div className="rounded-lg p-3" style={SOFT}>
                <span className="block text-[10px]" style={META}>
                  OSA %
                </span>
                <strong className="display text-lg tab-num">
                  {selectedStore.osaRatePct}%
                </strong>
              </div>
              <div className="rounded-lg p-3" style={SOFT}>
                <span className="block text-[10px]" style={META}>
                  Retail Price
                </span>
                <strong className="display text-lg tab-num">
                  ${selectedStore.latestPrice}
                </strong>
              </div>
            </div>

            {selectedStore.stockoutSignal && (
              <div
                className="rounded-xl p-3.5 flex items-start gap-2 text-xs"
                style={WARN_PILL}
              >
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Stockout / Shelf Alert</p>
                  <p className="mt-0.5">{selectedStore.stockoutSignal}</p>
                </div>
              </div>
            )}

            {selectedStore.competitorPromo && (
              <div className="rounded-xl p-3.5 text-xs" style={SOFT}>
                <p className="font-semibold">Competitor Promo Spotted</p>
                <p className="mt-0.5" style={META}>
                  {selectedStore.competitorPromo}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider mono" style={META}>
                Shopper Voice at This Door
              </h3>
              {selectedStore.quotes.map((q) => (
                <p
                  key={q}
                  className="text-xs italic rounded-xl p-3"
                  style={SOFT}
                >
                  “{q}”
                </p>
              ))}
            </div>

            <div className="pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: "#dcddd5" }}>
              <span className="text-xs" style={META}>
                Lead SKU: <strong>{selectedStore.topSku}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  const name = selectedStore.storeName;
                  setSelectedStore(null);
                  runAskQuestion(`How is ${name} performing on shelf and POS lift?`);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                style={{ background: "#14160f", color: "#ffffff" }}
              >
                <Sparkles size={12} />
                Ask Spark about this store
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Ask Spark Sandbox Drawer */}
      {askOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(20, 22, 15, 0.42)" }}
          onClick={() => setAskOpen(false)}
        >
          <aside
            role="dialog"
            aria-label="Ask Spark sample brand assistant"
            className="w-full max-w-lg h-full flex flex-col p-6 space-y-4"
            style={{ background: "#ffffff", color: "#14160f" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mono text-[10px] uppercase tracking-wider" style={META}>
                  Ask Spark · Sandbox Mode
                </p>
                <h2 className="display text-xl font-bold mt-0.5">
                  Ask about {payload.brand.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close Ask Spark"
                onClick={() => setAskOpen(false)}
                className="p-1.5 rounded-lg cursor-pointer"
                style={SOFT}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SANDBOX_SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => runAskQuestion(q)}
                  className="text-left px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:border-[#14160f]"
                  style={SOFT}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {askHistory.length === 0 ? (
                <div className="rounded-xl p-4 text-xs space-y-1.5" style={SOFT}>
                  <p className="font-semibold inline-flex items-center gap-1.5">
                    <CheckCircle2 size={14} style={{ color: "#2b4c08" }} />
                    Grounded strictly in approved Solstice data
                  </p>
                  <p style={META}>
                    Tap any prompt above or type a question about MSRP drift,
                    OOS stores, Whole Foods conversion, or rising competitors.
                  </p>
                </div>
              ) : (
                askHistory.map((item, idx) => (
                  <div
                    key={`${item.question}-${idx}`}
                    className="rounded-xl p-4 space-y-2"
                    style={SOFT}
                  >
                    <p className="text-xs font-bold">{item.question}</p>
                    <p className="text-xs font-semibold" style={{ color: "#2b4c08" }}>
                      {item.answer.headline}
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-xs" style={META}>
                      {item.answer.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    {item.answer.recommendedStoreKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.answer.recommendedStoreKeys.map((sk) => {
                          const st = payload.stores.find(
                            (s) => s.storeKey === sk,
                          );
                          if (!st) return null;
                          return (
                            <button
                              key={sk}
                              type="button"
                              onClick={() => {
                                setAskOpen(false);
                                setSelectedStore(st);
                              }}
                              className="px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer"
                              style={CARD}
                            >
                              Open {st.storeName} →
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAskQuestion(askInput);
              }}
              className="flex items-center gap-2 pt-2 border-t"
              style={{ borderColor: "#dcddd5" }}
            >
              <input
                type="text"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="Ask about MSRP drift, competitors, POS lift…"
                className="flex-1 px-3 py-2 rounded-lg text-xs"
                style={CARD}
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                style={{ background: "#14160f", color: "#ffffff" }}
              >
                <Send size={13} />
                Ask
              </button>
            </form>
          </aside>
        </div>
      )}

      {lightboxIndex != null && (
        <PhotoLightbox
          photos={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onStep={setLightboxIndex}
          loop
        />
      )}
    </div>
  );
};

export default SandboxBrandPage;
