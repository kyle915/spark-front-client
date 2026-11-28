import React, { Suspense, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Bar } from "react-chartjs-2";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";
import "@/lib/sparkChartRegister";
import { useAuthStore } from "@/store/authStore";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import { dispatchOpenAskSpark } from "@/lib/askSparkEvent";
import { useAppearance } from "@/theme/appearance";
import { barSeries, chartOptions, valueLabels } from "@/lib/sparkChart";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { REPORTS_HUB_TABS } from "@/shared/sparkHubNav";
import { PhotoLightbox, type PhotoLightboxItem } from "@/shared/PhotoLightbox";
import SparkThumb from "@/shared/SparkThumb";
import { thumbUrl } from "@/utils/thumb";
import ChartBlock from "@/components/charts/ChartBlock";
import { CompetitorMentions } from "@/components/charts/CommentInsights";
import PilotPeriodBar from "@/pilot/PilotPeriodBar";
import { SavedViewsDigestBar } from "@/pilot/SavedViewsDigestBar";
import { resolvePilotPeriod, type PilotRangeKey } from "@/pilot/pilotPeriodFilter";
import RegionalAlertsCard from "./RegionalAlertsCard";
import { ShelfVoiceHubQuery } from "@/api/queries/ShelfVoiceHubQuery";
import type { ShelfVoiceHubQuery as ShelfVoiceHubQueryType } from "@api/queries/__generated__/ShelfVoiceHubQuery.graphql";
import {
  aggregateOsaByMarket,
  computePriceDrift,
  filterShelfPhotos,
  filterShelfStores,
  parseMsrpTarget,
  storeHasShelfAttention,
  trendBadgeMeta,
  type ShelfPhotoFilter,
  type ShelfStoreFilter,
} from "./shelfVoiceHelpers";

const everyValue = valueLabels("all");
const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;

const OK_PILL = {
  background: "var(--spark-ok-bg)",
  color: "var(--spark-ok-ink)",
  border: "1px solid var(--spark-ok-border)",
} as const;

const WARN_PILL = {
  background: "rgba(239, 90, 42, 0.12)",
  color: "var(--spark-flag-ink, #a8340f)",
  border: "1px solid rgba(239, 90, 42, 0.34)",
} as const;

const MUTED_PILL = {
  background: "var(--spark-surface-2)",
  color: "var(--spark-text-meta)",
  border: "1px solid var(--spark-border)",
} as const;

function shelfStatusBadge(status: string): {
  label: string;
  style: React.CSSProperties;
} {
  if (status === "on_shelf" || status === "yes") {
    return { label: "On shelf", style: OK_PILL };
  }
  if (status === "not_found" || status === "no") {
    return { label: "Not found", style: WARN_PILL };
  }
  if (status === "pending") {
    return { label: "Awaiting audit", style: MUTED_PILL };
  }
  return { label: "Unclear", style: MUTED_PILL };
}

const ShelfVoiceBody: React.FC<{
  tenantId: string;
  range: PilotRangeKey;
  setRange: (r: PilotRangeKey) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  periodStart: string | null;
  periodEnd: string | null;
  periodControls: React.ReactNode;
}> = ({
  tenantId,
  range,
  setRange,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  periodStart,
  periodEnd,
  periodControls,
}) => {
  useAppearance();
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);

  const data = useLazyLoadQuery<ShelfVoiceHubQueryType>(
    ShelfVoiceHubQuery,
    {
      tenantId,
      startDate: periodStart,
      endDate: periodEnd,
    },
    { fetchPolicy: "store-and-network", fetchKey: tenantId },
  );
  const hub = data?.shelfVoiceHub;

  const [msrpInput, setMsrpInput] = useState("");
  const [storeFilter, setStoreFilter] = useState<ShelfStoreFilter>("all");
  const [storeQuery, setStoreQuery] = useState("");
  const [photoFilter, setPhotoFilter] = useState<ShelfPhotoFilter>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const targetMsrp = useMemo(
    () => parseMsrpTarget(msrpInput, hub?.medianPrice),
    [msrpInput, hub?.medianPrice],
  );

  const stores = useMemo(() => hub?.stores ?? [], [hub?.stores]);
  const shelfPhotos = useMemo(() => hub?.shelfPhotos ?? [], [hub?.shelfPhotos]);
  const beforeAfterPairs = useMemo(
    () => hub?.beforeAfterPairs ?? [],
    [hub?.beforeAfterPairs],
  );
  const competitorMarkets = useMemo(
    () => hub?.competitorMarkets ?? [],
    [hub?.competitorMarkets],
  );
  const competitorPromos = useMemo(
    () => hub?.competitorPromos ?? [],
    [hub?.competitorPromos],
  );

  const filterCounts = useMemo(() => {
    let attention = 0;
    let oos = 0;
    let missingTag = 0;
    let priceDrift = 0;
    let lowFacings = 0;
    for (const s of stores) {
      if (storeHasShelfAttention(s, targetMsrp)) attention += 1;
      if (s.notFoundVisits > 0 || s.oosGapVisits > 0 || Boolean(s.stockoutSignal)) {
        oos += 1;
      }
      if (s.missingTagVisits > 0) missingTag += 1;
      if (computePriceDrift(s.latestPrice, targetMsrp)?.isDrift) priceDrift += 1;
      if (s.latestFacings != null && s.latestFacings <= 2) lowFacings += 1;
    }
    return {
      all: stores.length,
      attention,
      oos,
      missing_tag: missingTag,
      price_drift: priceDrift,
      low_facings: lowFacings,
    };
  }, [stores, targetMsrp]);

  const visibleStores = useMemo(
    () => filterShelfStores(stores, storeFilter, storeQuery, targetMsrp),
    [stores, storeFilter, storeQuery, targetMsrp],
  );

  const visiblePhotos = useMemo(
    () => filterShelfPhotos(shelfPhotos, photoFilter),
    [shelfPhotos, photoFilter],
  );

  const marketOsaRows = useMemo(() => aggregateOsaByMarket(stores), [stores]);

  const lightboxItems: PhotoLightboxItem[] = useMemo(
    () =>
      visiblePhotos.map((p) => {
        const metaParts = [
          p.storeName,
          p.market,
          p.eventDate,
          p.facings != null ? `${p.facings} facings` : null,
          p.price ? `$${p.price}` : null,
          p.productOnShelf === "no" ? "Not found on shelf" : null,
          p.priceTagVisible === "no" ? "Missing price tag" : null,
        ].filter(Boolean);
        return {
          url: p.photoUrl,
          thumb: thumbUrl(p.photoUrl, 400) || p.photoUrl,
          caption: metaParts.join(" · "),
          name: p.storeName,
        };
      }),
    [visiblePhotos],
  );

  if (!hub) return null;

  const effectiveStart = hub.startDate || periodStart || "";
  const effectiveEnd = hub.endDate || periodEnd || "";

  const openPhotoInLightbox = (fileId: string) => {
    const idx = visiblePhotos.findIndex((p) => p.fileId === fileId);
    if (idx >= 0) {
      setLightboxIndex(idx);
      return;
    }
    setPhotoFilter("all");
    const allIdx = shelfPhotos.findIndex((p) => p.fileId === fileId);
    if (allIdx >= 0) setLightboxIndex(allIdx);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <SparkPageHeader
        eyebrow="Shelf compliance · Pricing · Competitor voice"
        title="Shelf & Voice Intelligence"
        support={
          <span className="tab-num">
            {effectiveStart && effectiveEnd
              ? `${effectiveStart} → ${effectiveEnd}`
              : "All time"}{" "}
            · <strong>{hub.auditedVisits}</strong> audited shelf{" "}
            {hub.auditedVisits === 1 ? "visit" : "visits"}
            {hub.unreadVisits > 0 ? ` · ${hub.unreadVisits} awaiting audit` : ""}
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {periodControls}
            <button
              type="button"
              onClick={() =>
                dispatchOpenAskSpark({
                  tenantId,
                  question:
                    "Summarize our on-shelf availability, stores with missing price tags or MSRP drift, and rising competitor mentions by market.",
                })
              }
              className="spark-btn-ghost text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} strokeWidth={1.85} />
              Ask Spark
            </button>
            <Link
              to="/setup-guide#shelf-voice"
              className="spark-btn-ghost text-xs px-3 py-2 rounded-lg inline-flex items-center no-underline"
            >
              Setup guide
            </Link>
          </div>
        }
      />

      <SavedViewsDigestBar
        surface="shelf_voice"
        defaultPlaceholder="Shelf OOS & MSRP Drift · Last 90d"
        currentFilters={{
          range,
          ...(customStart ? { customStart } : {}),
          ...(customEnd ? { customEnd } : {}),
          ...(storeFilter !== "all" ? { storeFilter } : {}),
          ...(storeQuery ? { storeQuery } : {}),
          ...(msrpInput.trim() ? { targetMsrp: msrpInput.trim() } : {}),
        }}
        onApply={(f) => {
          if (f.range) setRange(f.range as PilotRangeKey);
          setCustomStart(f.customStart ?? "");
          setCustomEnd(f.customEnd ?? "");
          setStoreFilter((f.storeFilter as ShelfStoreFilter) || "all");
          setStoreQuery(f.storeQuery ?? "");
          setMsrpInput(f.targetMsrp ?? "");
        }}
      />

      <Suspense fallback={null}>
        <RegionalAlertsCard
          tenantId={tenantId}
          suggestedStates={Array.from(
            new Set(
              stores
                .map((s) => (s.stateCode || "").trim().toUpperCase())
                .filter((c) => c.length === 2),
            ),
          )}
          activeTargetMsrp={targetMsrp}
        />
      </Suspense>

      {/* 1. Executive Compliance & MSRP Strip */}
      <section
        aria-label="Shelf compliance headline metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="spark-card p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={META}>
              On-Shelf Availability (OSA)
            </span>
            <CheckCircle2
              size={15}
              style={{
                color:
                  (hub.osaRatePct ?? 100) >= 85
                    ? "var(--spark-ok-ink)"
                    : "var(--spark-flag-ink, #a8340f)",
              }}
            />
          </div>
          <p className="display text-3xl font-bold tab-num" style={TEXT}>
            {hub.osaRatePct != null ? `${hub.osaRatePct}%` : "—"}
          </p>
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: "var(--spark-surface-2)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, hub.osaRatePct ?? 0))}%`,
                background:
                  (hub.osaRatePct ?? 100) >= 85
                    ? "var(--spark-ok-ink)"
                    : "var(--spark-flag-ink, #a8340f)",
              }}
            />
          </div>
          <p className="text-xs tab-num" style={META}>
            {hub.onShelfCount} on shelf · {hub.notFoundCount} not found
            {hub.oosGapsCount > 0 ? ` · ${hub.oosGapsCount} OOS gaps` : ""}
          </p>
        </div>

        <div className="spark-card p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={META}>
              Price Tag Compliance
            </span>
            <Tag size={15} style={META} />
          </div>
          <p className="display text-3xl font-bold tab-num" style={TEXT}>
            {hub.priceTagRatePct != null ? `${hub.priceTagRatePct}%` : "—"}
          </p>
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: "var(--spark-surface-2)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, hub.priceTagRatePct ?? 0))}%`,
                background:
                  (hub.priceTagRatePct ?? 100) >= 80
                    ? "var(--spark-ok-ink)"
                    : "var(--spark-flag-ink, #a8340f)",
              }}
            />
          </div>
          <p className="text-xs tab-num" style={META}>
            {hub.priceTagVisibleCount} tagged · {hub.missingTagCount} missing tag
          </p>
        </div>

        <div className="spark-card p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={META}>
              Facings & Shelf Gaps
            </span>
            <AlertTriangle
              size={15}
              style={{
                color:
                  hub.oosGapsCount > 0
                    ? "var(--spark-flag-ink, #a8340f)"
                    : "var(--spark-text-meta)",
              }}
            />
          </div>
          <p className="display text-3xl font-bold tab-num" style={TEXT}>
            {hub.avgFacings != null ? hub.avgFacings : "—"}
          </p>
          <p className="text-xs tab-num" style={META}>
            Avg front facings per audited shelf
          </p>
          <p className="text-xs tab-num" style={SECONDARY}>
            {filterCounts.attention}{" "}
            {filterCounts.attention === 1 ? "store" : "stores"} flagged for
            attention
          </p>
        </div>

        <div className="spark-card p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={META}>
              Observed Price & Target MSRP
            </span>
            <TrendingUp size={15} style={META} />
          </div>
          <p className="display text-3xl font-bold tab-num" style={TEXT}>
            {hub.medianPrice ? `$${hub.medianPrice}` : "—"}
          </p>
          <p className="text-[11px] tab-num" style={META}>
            {hub.minPrice && hub.maxPrice
              ? `Range $${hub.minPrice}–$${hub.maxPrice} (${hub.pricedVisitsCount} reads)`
              : "No legible shelf prices read in window"}
          </p>
          <label className="flex items-center gap-1.5 pt-0.5 text-xs">
            <span className="shrink-0 font-medium" style={META}>
              Target MSRP $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={msrpInput}
              onChange={(e) => setMsrpInput(e.target.value)}
              placeholder={hub.medianPrice ?? "e.g. 2.49"}
              aria-label="Target MSRP price in dollars"
              className="w-24 px-2 py-1 rounded-md text-xs tab-num"
              style={FIELD_STYLE}
            />
          </label>
        </div>
      </section>

      {/* 2. OSA by Market (Chart <-> Table) */}
      {marketOsaRows.length > 1 ? (
        <section className="spark-card p-5 space-y-2">
          <ChartBlock
            title="On-shelf availability (OSA %) by market"
            height={Math.max(150, Math.min(10, marketOsaRows.length) * 34 + 36)}
            categoryHeader="Market"
            valueHeader="OSA %"
            tableRows={marketOsaRows.map((m) => ({
              label: `${m.market} (${m.stores} ${m.stores === 1 ? "store" : "stores"})`,
              value: m.osaRatePct,
            }))}
          >
            <Bar
              data={{
                labels: marketOsaRows.slice(0, 10).map((m) => m.market),
                datasets: [
                  barSeries({
                    label: "OSA %",
                    data: marketOsaRows.slice(0, 10).map((m) => m.osaRatePct),
                    horizontal: true,
                  }),
                ],
              }}
              options={chartOptions<"bar">({ horizontal: true })}
              plugins={[everyValue]}
            />
          </ChartBlock>
          <p className="text-xs" style={META}>
            Lowest-compliance markets listed first — switch to Table to copy rows.
          </p>
        </section>
      ) : null}

      {/* 3. Store-by-Store Shelf, Missing Tag & MSRP Drift Table */}
      <section className="spark-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="display text-lg font-bold">
              Store Shelf Compliance & MSRP Drift
            </h2>
            <p className="text-xs mt-0.5" style={META}>
              {targetMsrp != null
                ? `Flagging shelf prices drifting ±5% or more from $${targetMsrp.toFixed(2)} ${
                    msrpInput.trim() ? "target MSRP" : "observed median"
                  }. Click any store to open its Store Profile.`
                : "Click any store to inspect visits, logistics notes, and shelf history in StoreSheet."}
            </p>
          </div>
          <label className="relative flex items-center">
            <Search
              size={14}
              className="absolute left-2.5 pointer-events-none"
              style={META}
            />
            <input
              type="search"
              value={storeQuery}
              onChange={(e) => setStoreQuery(e.target.value)}
              placeholder="Search store or market…"
              aria-label="Search stores in shelf compliance table"
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs w-56"
              style={FIELD_STYLE}
            />
          </label>
        </div>

        <div
          className="pill-group flex-wrap"
          role="group"
          aria-label="Filter stores by shelf issue"
        >
          {(
            [
              ["all", "All audited", filterCounts.all],
              ["attention", "Needs attention", filterCounts.attention],
              ["oos", "OOS / Not found", filterCounts.oos],
              ["missing_tag", "Missing tag", filterCounts.missing_tag],
              ["price_drift", "MSRP drift", filterCounts.price_drift],
              ["low_facings", "Low facings (≤2)", filterCounts.low_facings],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStoreFilter(key)}
              className={`pill-btn tab-num ${storeFilter === key ? "on" : ""}`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {visibleStores.length === 0 ? (
          <p className="text-xs py-2" style={META}>
            {stores.length === 0
              ? "No audited shelf readings in this date window yet. Shelf photos filed on approved retail recaps appear here automatically."
              : "No stores match the current filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={META}>
                  <th className="py-2 pr-3">Store / Market</th>
                  <th className="py-2 pr-3">Latest Shelf Status</th>
                  <th className="py-2 pr-3 text-right">OSA %</th>
                  <th className="py-2 pr-3 text-right">Facings</th>
                  <th className="py-2 pr-3 text-right">Shelf Price & Drift</th>
                  <th className="py-2 pr-3 text-right">Missing Tags</th>
                  <th className="py-2 text-right">Signals</th>
                </tr>
              </thead>
              <tbody>
                {visibleStores.map((row) => {
                  const statusBadge = shelfStatusBadge(row.latestStatus);
                  const drift = computePriceDrift(row.latestPrice, targetMsrp);
                  return (
                    <tr
                      key={`${row.storeKey || row.storeName}-${row.latestDate}`}
                      style={{ borderTop: "1px solid var(--spark-border)" }}
                    >
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() =>
                            openStoreSheet({
                              storeKey: row.storeKey || undefined,
                              recapId: row.latestRecapUuid || undefined,
                              storeName: row.storeName,
                              fallbackTitle: row.storeName,
                            })
                          }
                          className="font-semibold text-left hover:underline cursor-pointer"
                          style={TEXT}
                        >
                          {row.storeName}
                        </button>
                        <div className="text-[11px] tab-num" style={META}>
                          {row.market} · {row.visitCount}{" "}
                          {row.visitCount === 1 ? "visit" : "visits"} ·{" "}
                          {row.latestDate}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap"
                          style={statusBadge.style}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tab-num font-semibold">
                        {row.osaRatePct != null ? `${row.osaRatePct}%` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tab-num">
                        {row.latestFacings != null ? (
                          <span>
                            <strong>{row.latestFacings}</strong>
                            {row.avgFacings != null &&
                            row.avgFacings !== row.latestFacings ? (
                              <span style={META}> (avg {row.avgFacings})</span>
                            ) : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tab-num">
                        {row.latestPrice ? (
                          <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                            <span className="font-semibold">
                              ${row.latestPrice}
                            </span>
                            {drift ? (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={drift.isDrift ? WARN_PILL : OK_PILL}
                              >
                                {drift.deltaPct > 0 ? "+" : ""}
                                {drift.deltaPct}%
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span style={META}>—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tab-num">
                        {row.missingTagVisits > 0 ? (
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                            style={WARN_PILL}
                          >
                            {row.missingTagVisits} missing
                          </span>
                        ) : (
                          <span style={META}>0</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1 flex-wrap">
                          {row.oosGapVisits > 0 ? (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                              style={WARN_PILL}
                            >
                              OOS gap
                            </span>
                          ) : null}
                          {row.stockoutSignal ? (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                              style={WARN_PILL}
                              title={row.stockoutSignal}
                            >
                              Stockout note
                            </span>
                          ) : null}
                          {row.competitorPromo ? (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                              style={MUTED_PILL}
                              title={row.competitorPromo}
                            >
                              Comp promo
                            </span>
                          ) : null}
                          {row.hasBeforeAfter ? (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                              style={OK_PILL}
                            >
                              Before/After
                            </span>
                          ) : null}
                          {!row.oosGapVisits &&
                          !row.stockoutSignal &&
                          !row.competitorPromo &&
                          !row.hasBeforeAfter ? (
                            <span style={META}>—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Before & After Shelf Comparison + Audited Shelf Proof Photos */}
      {beforeAfterPairs.length > 0 ? (
        <section className="spark-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="display text-lg font-bold">
                Before & After Shelf Proof ({beforeAfterPairs.length})
              </h2>
              <p className="text-xs mt-0.5" style={META}>
                Earliest vs latest audited shelf photos at repeat-visit doors —
                click any photo to inspect full-screen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {beforeAfterPairs.map((pair) => (
              <article
                key={`${pair.storeKey || pair.storeName}-${pair.afterPhoto.fileId}`}
                className="rounded-xl p-3.5 space-y-2.5"
                style={{ ...BORDER, background: "var(--spark-surface-2)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        openStoreSheet({
                          storeKey: pair.storeKey || undefined,
                          recapId: pair.afterPhoto.recapUuid || undefined,
                          storeName: pair.storeName,
                          fallbackTitle: pair.storeName,
                        })
                      }
                      className="font-semibold text-sm hover:underline cursor-pointer text-left"
                      style={TEXT}
                    >
                      {pair.storeName}
                    </button>
                    <p className="text-[11px] tab-num" style={META}>
                      {pair.market} · {pair.photoCount} audited shelf photos
                    </p>
                  </div>
                  {pair.beforePhoto.facings != null &&
                  pair.afterPhoto.facings != null ? (
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold tab-num"
                      style={
                        pair.afterPhoto.facings >= pair.beforePhoto.facings
                          ? OK_PILL
                          : WARN_PILL
                      }
                    >
                      Facings {pair.beforePhoto.facings} →{" "}
                      {pair.afterPhoto.facings}
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      ["Before", pair.beforePhoto],
                      ["Latest", pair.afterPhoto],
                    ] as const
                  ).map(([tag, photo]) => {
                    const badge = shelfStatusBadge(photo.productOnShelf);
                    return (
                      <button
                        key={`${tag}-${photo.fileId}`}
                        type="button"
                        onClick={() => openPhotoInLightbox(photo.fileId)}
                        className="rounded-lg overflow-hidden text-left cursor-pointer transition hover:opacity-95"
                        style={{ ...BORDER, background: "var(--spark-surface)" }}
                      >
                        <div className="relative aspect-[4/3]">
                          <SparkThumb
                            sources={[
                              thumbUrl(photo.photoUrl, 400),
                              photo.photoUrl,
                            ]}
                            alt={`${tag} shelf at ${pair.storeName}`}
                          />
                          <span
                            className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              background: "rgba(20, 22, 15, 0.8)",
                              color: "#ffffff",
                            }}
                          >
                            {tag} · {photo.eventDate}
                          </span>
                        </div>
                        <div className="p-2 flex flex-wrap items-center gap-1.5 text-[11px] tab-num">
                          <span
                            className="px-1.5 py-0.5 rounded font-semibold"
                            style={badge.style}
                          >
                            {badge.label}
                          </span>
                          {photo.facings != null ? (
                            <span style={SECONDARY}>
                              {photo.facings} facings
                            </span>
                          ) : null}
                          {photo.price ? (
                            <span className="font-semibold" style={TEXT}>
                              ${photo.price}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {shelfPhotos.length > 0 ? (
        <section className="spark-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <Camera size={16} style={META} />
              <h2 className="display text-lg font-bold tab-num">
                Audited Shelf Photos ({visiblePhotos.length})
              </h2>
            </div>
            <div className="pill-group" role="group" aria-label="Filter shelf photos">
              {(
                [
                  ["all", "All"],
                  ["oos", "OOS / Gaps"],
                  ["missing_tag", "Missing tag"],
                  ["on_shelf", "On shelf"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPhotoFilter(key)}
                  className={`pill-btn ${photoFilter === key ? "on" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visiblePhotos.map((p, idx) => {
              const badge = shelfStatusBadge(p.productOnShelf);
              return (
                <article
                  key={p.fileId}
                  className="rounded-xl overflow-hidden flex flex-col"
                  style={BORDER}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="relative aspect-[4/3] w-full block cursor-pointer"
                    style={{ background: "var(--spark-surface-2)" }}
                  >
                    <SparkThumb
                      sources={[thumbUrl(p.photoUrl, 400), p.photoUrl]}
                      alt={`Shelf photo at ${p.storeName}`}
                    />
                    <span
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                      style={badge.style}
                    >
                      {badge.label}
                    </span>
                    {p.price ? (
                      <span
                        className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[11px] font-semibold tab-num"
                        style={{
                          background: "rgba(20, 22, 15, 0.82)",
                          color: "#ffffff",
                        }}
                      >
                        ${p.price}
                      </span>
                    ) : null}
                  </button>
                  <div className="p-2.5 space-y-1 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        openStoreSheet({
                          storeKey: p.storeKey || undefined,
                          recapId: p.recapUuid || undefined,
                          storeName: p.storeName,
                          fallbackTitle: p.storeName,
                        })
                      }
                      className="text-xs font-semibold text-left hover:underline cursor-pointer line-clamp-1"
                      style={TEXT}
                    >
                      {p.storeName}
                    </button>
                    <p className="text-[11px] tab-num line-clamp-1" style={META}>
                      {p.market} · {p.eventDate}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] tab-num">
                      {p.facings != null ? (
                        <span style={SECONDARY}>{p.facings} facings</span>
                      ) : null}
                      {p.priceTagVisible === "no" ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={WARN_PILL}
                        >
                          No tag
                        </span>
                      ) : null}
                      {p.outOfStockGap === "yes" ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={WARN_PILL}
                        >
                          OOS gap
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 5. Competitor Voice & Rising Mentions by Market */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 spark-card p-5">
          <CompetitorMentions
            tenantId={tenantId}
            startDate={effectiveStart}
            endDate={effectiveEnd}
          />
        </div>

        <div className="lg:col-span-6 spark-card p-5 space-y-4">
          <div>
            <h2 className="display text-lg font-bold">
              Rising Competitor Mentions by Market
            </h2>
            <p className="text-xs mt-0.5" style={META}>
              Shopper brand mentions grouped by market vs the prior equal-length
              window. Click any store to open StoreSheet.
            </p>
          </div>

          {competitorMarkets.length === 0 ? (
            <p className="text-xs py-2" style={META}>
              No market-attributed competitor mentions recorded in this window
              yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {competitorMarkets.slice(0, 12).map((cm) => {
                const badge = trendBadgeMeta(cm.trend);
                return (
                  <div
                    key={`${cm.market}-${cm.competitorBrand}`}
                    className="rounded-xl p-3.5 space-y-1.5"
                    style={{ ...BORDER, background: "var(--spark-surface-2)" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={TEXT}>
                          {cm.competitorBrand}
                        </span>
                        <span className="text-xs" style={META}>
                          in {cm.market}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-2 tab-num text-xs">
                        <span className="font-semibold" style={TEXT}>
                          {cm.mentionCount}{" "}
                          {cm.mentionCount === 1 ? "recap" : "recaps"}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                          {cm.priorMentionCount > 0
                            ? ` (${cm.delta > 0 ? "+" : ""}${cm.delta} vs ${cm.priorMentionCount})`
                            : ""}
                        </span>
                      </div>
                    </div>
                    {cm.sampleQuote ? (
                      <p className="text-xs leading-relaxed" style={SECONDARY}>
                        “{cm.sampleQuote}”
                      </p>
                    ) : null}
                    {cm.sampleStoreName ? (
                      <button
                        type="button"
                        onClick={() =>
                          openStoreSheet({
                            storeKey: cm.sampleStoreKey || undefined,
                            recapId: cm.sampleRecapUuid || undefined,
                            storeName: cm.sampleStoreName,
                            fallbackTitle: cm.sampleStoreName,
                          })
                        }
                        className="text-[11px] font-medium underline underline-offset-2 cursor-pointer"
                        style={META}
                      >
                        Example door: {cm.sampleStoreName} →
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 6. In-Store Competitor Promo Alerts */}
      {competitorPromos.length > 0 ? (
        <section className="spark-card p-5 space-y-3">
          <div>
            <h2 className="display text-lg font-bold tab-num">
              Field-Reported Competitor Promos ({competitorPromos.length})
            </h2>
            <p className="text-xs mt-0.5" style={META}>
              Endcap promotions, BOGOs, and rival demos flagged in approved
              shift recaps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {competitorPromos.map((cp) => (
              <div
                key={`${cp.recapUuid}-${cp.competitorBrand}`}
                className="rounded-xl p-3.5 space-y-1.5"
                style={{ ...BORDER, background: "var(--spark-surface-2)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openStoreSheet({
                        storeKey: cp.storeKey || undefined,
                        recapId: cp.recapUuid || undefined,
                        storeName: cp.storeName,
                        fallbackTitle: cp.storeName,
                      })
                    }
                    className="font-semibold text-xs text-left hover:underline cursor-pointer"
                    style={TEXT}
                  >
                    {cp.storeName}
                  </button>
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                    style={WARN_PILL}
                  >
                    {cp.competitorBrand}
                  </span>
                </div>
                <p className="text-[11px] tab-num" style={META}>
                  {cp.market} · {cp.eventDate}
                </p>
                <p className="text-xs leading-snug" style={SECONDARY}>
                  {cp.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {lightboxIndex !== null && lightboxItems[lightboxIndex] ? (
        <PhotoLightbox
          photos={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onStep={setLightboxIndex}
        />
      ) : null}
    </div>
  );
};

export const ShelfVoicePage: React.FC = () => {
  const tenantId = useAuthStore((s) => s.tenantId);
  const [range, setRange] = useState<PilotRangeKey>("90d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { periodStart, periodEnd } = useMemo(
    () => resolvePilotPeriod(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  return (
    <div className="space-y-5 max-w-7xl spark-scale">
      <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
      {!tenantId ? (
        <p className="text-sm" style={META}>
          Select a brand workspace to view shelf compliance and competitor voice.
        </p>
      ) : (
        <Suspense
          fallback={
            <p className="text-sm" style={META}>
              Loading shelf compliance & competitor voice…
            </p>
          }
        >
          <ShelfVoiceBody
            key={tenantId}
            tenantId={String(tenantId)}
            range={range}
            setRange={setRange}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            periodStart={periodStart}
            periodEnd={periodEnd}
            periodControls={
              <PilotPeriodBar
                range={range}
                onRangeChange={setRange}
                customStart={customStart}
                onCustomStartChange={setCustomStart}
                customEnd={customEnd}
                onCustomEndChange={setCustomEnd}
                ariaLabel="Shelf and voice date window"
              />
            }
          />
        </Suspense>
      )}
    </div>
  );
};

export default ShelfVoicePage;
