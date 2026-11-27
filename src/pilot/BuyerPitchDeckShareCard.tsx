import React, { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Link } from "react-router";
import {
  Download,
  ExternalLink,
  Presentation,
  Sparkles,
} from "lucide-react";
import {
  PitchDeckQueriesBuyerPitchDecksQuery,
  PitchDeckQueriesPhotoWallQuery,
} from "@/api/queries/PitchDeckQueries";
import type { PitchDeckQueriesBuyerPitchDecksQuery as DecksQueryType } from "@/api/queries/__generated__/PitchDeckQueriesBuyerPitchDecksQuery.graphql";
import type { PitchDeckQueriesPhotoWallQuery as PhotoWallQueryType } from "@/api/queries/__generated__/PitchDeckQueriesPhotoWallQuery.graphql";
import {
  PitchDeckMutationsCreateDeckMutation,
  PitchDeckMutationsRevokeDeckMutation,
} from "@/api/mutations/PitchDeckMutations";
import type { PitchDeckMutationsCreateDeckMutation as CreateDeckType } from "@/api/mutations/__generated__/PitchDeckMutationsCreateDeckMutation.graphql";
import type { PitchDeckMutationsRevokeDeckMutation as RevokeDeckType } from "@/api/mutations/__generated__/PitchDeckMutationsRevokeDeckMutation.graphql";
import { pitchPublicUrl } from "@/utils/publicHosts";
import { thumbUrl } from "@/utils/thumb";
import { downloadBuyerDeckPptx } from "@/public/pitch/buyerDeckPptx";
import { fetchPublicPitchPayload } from "@/public/pitch/pitchDeckTypes";

const META = { color: "var(--spark-text-meta)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const PRIMARY_BTN_STYLE = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
  border: "1px solid var(--spark-lime)",
} as const;

const DECK_PRESETS = [
  {
    key: "qbr",
    label: "QBR / Line Review",
    titleFor: (banner: string, brand: string) =>
      banner ? `${banner} Quarterly Business Review` : `${brand} Retail Buyer QBR`,
    subtitle: "In-store sampling velocity, 2–4 week POS halo & shelf compliance",
  },
  {
    key: "expansion",
    label: "Door Expansion Pitch",
    titleFor: (banner: string, brand: string) =>
      banner ? `${banner} Distribution Expansion Pitch` : `${brand} Category Expansion Deck`,
    subtitle: "Proven door velocity, shopper feedback & merchandising proof",
  },
  {
    key: "lift",
    label: "Post-Demo Lift Readout",
    titleFor: (banner: string, brand: string) =>
      banner ? `${banner} Post-Demo Lift Readout` : `${brand} Sampling Lift Readout`,
    subtitle: "Baseline vs demo week & post-demo register lift summary",
  },
] as const;

type Props = {
  brandName?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  retailerFilter: string;
  onRetailerFilterChange?: (v: string) => void;
  marketFilter: string;
  onMarketFilterChange?: (v: string) => void;
  providerUuid: string;
  retailerBanners?: readonly string[];
  markets?: readonly string[];
};

const DecksList: React.FC<
  Props & {
    fetchKey: number;
    bump: () => void;
  }
> = ({
  brandName = "Brand",
  periodStart = null,
  periodEnd = null,
  retailerFilter,
  onRetailerFilterChange,
  marketFilter,
  providerUuid,
  retailerBanners = [],
  fetchKey,
  bump,
}) => {
  const data = useLazyLoadQuery<DecksQueryType>(
    PitchDeckQueriesBuyerPitchDecksQuery,
    {},
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const pinnedData = useLazyLoadQuery<PhotoWallQueryType>(
    PitchDeckQueriesPhotoWallQuery,
    {
      startDate: null,
      endDate: null,
      retailer: null,
      market: null,
      sku: null,
      category: null,
      search: null,
      pinnedOnly: true,
      first: 24,
      offset: 0,
    },
    { fetchPolicy: "store-and-network", fetchKey },
  );

  const [commitCreate, creating] = useMutation<CreateDeckType>(
    PitchDeckMutationsCreateDeckMutation,
  );
  const [commitRevoke, revoking] = useMutation<RevokeDeckType>(
    PitchDeckMutationsRevokeDeckMutation,
  );

  const [presetKey, setPresetKey] = useState<string>("qbr");
  const [title, setTitle] = useState(
    retailerFilter
      ? `${retailerFilter} Quarterly Business Review`
      : "Retail Buyer QBR & Line-Review Deck",
  );
  const [subtitle, setSubtitle] = useState<string>(DECK_PRESETS[0].subtitle);
  const [buyerName, setBuyerName] = useState("");
  const [introNote, setIntroNote] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [passcode, setPasscode] = useState("");
  const [includeCosts, setIncludeCosts] = useState(false);
  const [scopePinsToBanner, setScopePinsToBanner] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [banner, setBanner] = useState<string | null>(null);
  const [lastDeck, setLastDeck] = useState<{ token: string; url: string; hasPasscode: boolean } | null>(null);
  const [downloadingToken, setDownloadingToken] = useState<string | null>(null);

  const pinnedPhotos = useMemo(
    () => pinnedData.photoWall?.photos ?? [],
    [pinnedData.photoWall?.photos],
  );
  const matchingBannerPins = useMemo(() => {
    const rf = retailerFilter.trim().toLowerCase();
    if (!rf) return pinnedPhotos;
    return pinnedPhotos.filter(
      (p) =>
        (p.retailer || "").toLowerCase().includes(rf) ||
        (p.store || "").toLowerCase().includes(rf),
    );
  }, [pinnedPhotos, retailerFilter]);

  const effectivePins =
    scopePinsToBanner && retailerFilter.trim() ? matchingBannerPins : pinnedPhotos;

  const effectiveStart = customStart.trim() || periodStart || null;
  const effectiveEnd = customEnd.trim() || periodEnd || null;

  const applyPreset = (key: string) => {
    setPresetKey(key);
    const preset = DECK_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setTitle(preset.titleFor(retailerFilter.trim(), brandName));
    setSubtitle(preset.subtitle);
  };

  const handleBannerSelect = (nextBanner: string) => {
    onRetailerFilterChange?.(nextBanner);
    const preset = DECK_PRESETS.find((p) => p.key === presetKey);
    if (preset) {
      setTitle(preset.titleFor(nextBanner.trim(), brandName));
    }
  };

  const createDeck = () => {
    const daysRaw = expiresInDays.trim();
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : null;
    const explicitPinIds =
      scopePinsToBanner && retailerFilter.trim()
        ? matchingBannerPins.map((p) => p.id)
        : null;

    commitCreate({
      variables: {
        title: title.trim() || "Buyer Pitch Deck",
        subtitle: subtitle.trim() || null,
        buyerName: buyerName.trim() || null,
        introNote: introNote.trim() || null,
        periodStart: effectiveStart,
        periodEnd: effectiveEnd,
        retailerFilter: retailerFilter.trim() || null,
        marketFilter: marketFilter.trim() || null,
        providerUuid: providerUuid || null,
        includeCosts,
        passcode: passcode.trim() || null,
        expiresInDays: Number.isFinite(days) ? days : null,
        pinnedPhotoIds: explicitPinIds,
      },
      onCompleted: (res) => {
        const out = res.createBuyerPitchDeck;
        if (!out?.ok || !out.deck) {
          setBanner(out?.error || "Could not create pitch deck.");
          return;
        }
        const url = pitchPublicUrl(out.deck.token);
        setLastDeck({
          token: out.deck.token,
          url,
          hasPasscode: Boolean(out.deck.hasPasscode),
        });
        setBanner(
          "QBR deck ready — open the live interactive slides, copy the link, or export .pptx.",
        );
        bump();
      },
      onError: () => setBanner("Could not create pitch deck."),
    });
  };

  const revoke = (deckUuid: string) => {
    commitRevoke({
      variables: { deckUuid },
      onCompleted: (res) => {
        if (!res.revokeBuyerPitchDeck?.ok) {
          setBanner(res.revokeBuyerPitchDeck?.error || "Could not revoke.");
          return;
        }
        setBanner("Pitch deck link revoked.");
        bump();
      },
      onError: () => setBanner("Could not revoke."),
    });
  };

  const copyLink = async (token: string, hasCode: boolean) => {
    const url = pitchPublicUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setBanner("Share link copied to clipboard.");
      setLastDeck({ token, url, hasPasscode: hasCode });
    } catch {
      setLastDeck({ token, url, hasPasscode: hasCode });
      setBanner("Copy failed — link shown below.");
    }
  };

  const handleExportPptx = async (token: string, hasCode: boolean) => {
    if (hasCode) {
      setBanner(
        "This deck is passcode-protected — open the live deck link, unlock it, and click Download .pptx there.",
      );
      return;
    }
    setDownloadingToken(token);
    setBanner(null);
    try {
      const { status, payload } = await fetchPublicPitchPayload(token);
      if (status < 200 || status >= 300 || !payload || payload.locked) {
        setBanner(
          "Could not export .pptx directly — open the live deck link to export.",
        );
        return;
      }
      const slideCount = await downloadBuyerDeckPptx(payload);
      setBanner(`Downloaded ${slideCount}-slide PowerPoint (.pptx).`);
    } catch {
      setBanner("Could not build PowerPoint right now. Open the live deck to export.");
    } finally {
      setDownloadingToken(null);
    }
  };

  const photoWallHref = useMemo(() => {
    const qs = new URLSearchParams({ pinned: "1" });
    if (retailerFilter.trim()) qs.set("retailer", retailerFilter.trim());
    if (marketFilter.trim()) qs.set("market", marketFilter.trim());
    return `/photo-wall?${qs.toString()}`;
  }, [retailerFilter, marketFilter]);

  return (
    <section
      id="buyer-deck-builder"
      className="spark-card p-5 space-y-4"
      style={{ border: "1px solid var(--spark-border)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5">
            <Presentation size={15} strokeWidth={1.9} />
            <h2 className="display text-base font-bold">
              Build Buyer QBR / Line-Review Deck
            </h2>
          </div>
          <p className="text-xs max-w-2xl" style={META}>
            Select a retailer banner and date window to generate a 6–8 slide
            shareable web presentation + native{" "}
            <code className="mono">.pptx</code> with US footprint map, 2–4 week
            post-demo POS lift halo, OSA / shelf compliance, AI-distilled
            shopper quotes, and curated{" "}
            <Link to={photoWallHref} className="underline underline-offset-2">
              Photo Wall pins
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Deck template preset">
          {DECK_PRESETS.map((preset) => {
            const active = presetKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                style={
                  active
                    ? PRIMARY_BTN_STYLE
                    : {
                        ...FIELD_STYLE,
                        color: "var(--spark-text-secondary)",
                      }
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scope: Banner quick selector + date window */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <label className="space-y-1">
          <span className="font-medium" style={META}>
            Retailer banner
          </span>
          {retailerBanners.length > 0 && onRetailerFilterChange ? (
            <select
              value={retailerBanners.includes(retailerFilter) ? retailerFilter : ""}
              onChange={(e) => handleBannerSelect(e.target.value)}
              aria-label="Retailer banner for buyer deck"
              className="w-full px-3 py-2 rounded-lg"
              style={FIELD_STYLE}
            >
              <option value="">All banners in report</option>
              {retailerBanners.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={retailerFilter}
              onChange={(e) => handleBannerSelect(e.target.value)}
              placeholder="e.g. HEB, Kroger, Whole Foods"
              className="w-full px-3 py-2 rounded-lg"
              style={FIELD_STYLE}
            />
          )}
        </label>

        <label className="space-y-1">
          <span className="font-medium" style={META}>
            Deck title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deck title"
            className="w-full px-3 py-2 rounded-lg"
            style={FIELD_STYLE}
          />
        </label>

        <label className="space-y-1">
          <span className="font-medium" style={META}>
            Buyer name (optional)
          </span>
          <input
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="e.g. Sarah Chen · Beverage Buyer"
            className="w-full px-3 py-2 rounded-lg"
            style={FIELD_STYLE}
          />
        </label>

        <label className="space-y-1">
          <span className="font-medium" style={META}>
            Deck date range (inherits report window)
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="date"
              value={customStart || periodStart || ""}
              onChange={(e) => setCustomStart(e.target.value)}
              aria-label="Deck period start"
              className="w-full px-2 py-2 rounded-lg tab-num"
              style={FIELD_STYLE}
            />
            <input
              type="date"
              value={customEnd || periodEnd || ""}
              onChange={(e) => setCustomEnd(e.target.value)}
              aria-label="Deck period end"
              className="w-full px-2 py-2 rounded-lg tab-num"
              style={FIELD_STYLE}
            />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle (shown on Cover slide)"
          className="px-3 py-2 rounded-lg"
          style={FIELD_STYLE}
        />
        <input
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Optional passcode (4+ chars)"
          className="px-3 py-2 rounded-lg"
          style={FIELD_STYLE}
        />
        <input
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          placeholder="Expires in days (e.g. 30)"
          className="px-3 py-2 rounded-lg tab-num"
          style={FIELD_STYLE}
        />
      </div>

      <textarea
        value={introNote}
        onChange={(e) => setIntroNote(e.target.value)}
        rows={2}
        placeholder="Optional executive note (leave blank and Spark drafts a KPI-grounded sell-story automatically)"
        className="w-full px-3 py-2 rounded-lg text-xs"
        style={FIELD_STYLE}
      />

      {/* Pinned photos live strip */}
      <div
        className="rounded-xl p-3 space-y-2.5"
        style={{
          background: "var(--spark-surface-2)",
          border: "1px solid var(--spark-border)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">
              In-store proof pins ({effectivePins.length})
            </span>
            {retailerFilter.trim() && pinnedPhotos.length > 0 ? (
              <label className="inline-flex items-center gap-1.5" style={META}>
                <input
                  type="checkbox"
                  checked={scopePinsToBanner}
                  onChange={(e) => setScopePinsToBanner(e.target.checked)}
                />
                Only pins matching “{retailerFilter.trim()}” ({matchingBannerPins.length})
              </label>
            ) : null}
          </div>
          <Link
            to={photoWallHref}
            className="text-xs font-semibold underline underline-offset-2"
          >
            Curate pins on Photo Wall →
          </Link>
        </div>

        {effectivePins.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {effectivePins.slice(0, 8).map((p) => (
              <img
                key={p.id}
                src={thumbUrl(p.url, 400) || p.url}
                alt={p.store || p.retailer || "Pinned photo"}
                title={p.store || p.retailer || "Pinned photo"}
                className="h-12 w-16 rounded-lg object-cover shrink-0"
                style={{ border: "1px solid var(--spark-border)" }}
                loading="lazy"
              />
            ))}
            {effectivePins.length > 8 ? (
              <span className="text-[11px] tab-num shrink-0 px-1" style={META}>
                +{effectivePins.length - 8} more
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px]" style={META}>
            No photos pinned yet — pin shelf & demo shots on the Photo Wall to
            include visual proof slides automatically.
          </p>
        )}
      </div>

      {/* Included slide outline + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]" style={META}>
            <Sparkles size={12} strokeWidth={1.9} />
            <span>
              Auto-includes: Cover · KPIs & Banners · US Footprint Map · 2–4w
              POS Halo · Shelf OSA · Top Doors · Shopper Voice ·{" "}
              {effectivePins.length} Photos
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs" style={META}>
            <input
              type="checkbox"
              checked={includeCosts}
              onChange={(e) => setIncludeCosts(e.target.checked)}
            />
            Include cost-per-unit / supported spend (off by default for external
            buyers)
          </label>
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={createDeck}
          className="px-4 py-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          style={PRIMARY_BTN_STYLE}
        >
          <Presentation size={14} strokeWidth={1.9} />
          {creating ? "Building QBR Deck…" : "Build Buyer Deck"}
        </button>
      </div>

      {banner && (
        <div
          className="rounded-lg p-3 space-y-2 text-xs"
          style={{
            background: "var(--spark-ok-bg)",
            color: "var(--spark-ok-ink)",
            border: "1px solid var(--spark-ok-border)",
          }}
        >
          <p className="font-medium">{banner}</p>
          {lastDeck ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={lastDeck.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold no-underline"
                style={PRIMARY_BTN_STYLE}
              >
                Open Live Deck
                <ExternalLink size={12} />
              </a>
              <button
                type="button"
                disabled={downloadingToken === lastDeck.token}
                onClick={() =>
                  void handleExportPptx(lastDeck.token, lastDeck.hasPasscode)
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer"
                style={FIELD_STYLE}
              >
                <Download size={12} />
                {downloadingToken === lastDeck.token
                  ? "Building .pptx…"
                  : "Download .pptx"}
              </button>
              <span className="mono text-[11px] break-all opacity-80">
                {lastDeck.url}
              </span>
            </div>
          ) : null}
        </div>
      )}

      <div
        className="space-y-2 pt-3 border-t"
        style={{ borderColor: "var(--spark-border)" }}
      >
        <p className="text-[11px] uppercase tracking-wider font-semibold" style={META}>
          Recent buyer decks
        </p>
        {(data.buyerPitchDecks ?? []).length === 0 && (
          <p className="text-xs" style={META}>
            No decks yet for this brand.
          </p>
        )}
        {(data.buyerPitchDecks ?? []).map((deck) => (
          <div
            key={deck.uuid}
            className="flex flex-wrap items-center justify-between gap-2 text-xs py-2"
            style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
          >
            <div className="min-w-0">
              <p className="font-semibold">
                {deck.title}
                {deck.buyerName ? ` · ${deck.buyerName}` : ""}
              </p>
              <p className="tab-num" style={META}>
                {deck.periodStart} → {deck.periodEnd}
                {deck.retailerFilter ? ` · ${deck.retailerFilter}` : ""}
                {deck.revokedAt
                  ? " · revoked"
                  : deck.hasPasscode
                    ? " · passcode"
                    : ""}
                {" · "}
                {deck.photoCount} photos · {deck.viewCount} views
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {!deck.revokedAt && (
                <>
                  <a
                    href={pitchPublicUrl(deck.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold no-underline"
                    style={FIELD_STYLE}
                  >
                    Open
                    <ExternalLink size={12} />
                  </a>
                  <button
                    type="button"
                    disabled={downloadingToken === deck.token}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                    style={FIELD_STYLE}
                    onClick={() =>
                      void handleExportPptx(deck.token, deck.hasPasscode)
                    }
                    title={
                      deck.hasPasscode
                        ? "Passcode-protected: open live link to unlock and download .pptx"
                        : "Download editable 16:9 PowerPoint (.pptx)"
                    }
                  >
                    <Download size={12} />
                    {downloadingToken === deck.token ? "Building…" : ".pptx"}
                  </button>
                  <button
                    type="button"
                    className="px-2.5 py-1.5 rounded-lg cursor-pointer"
                    style={FIELD_STYLE}
                    onClick={() => void copyLink(deck.token, deck.hasPasscode)}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    disabled={revoking}
                    className="px-2.5 py-1.5 rounded-lg cursor-pointer"
                    style={FIELD_STYLE}
                    onClick={() => revoke(deck.uuid)}
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export const BuyerPitchDeckShareCard: React.FC<Props> = (props) => {
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <Suspense
      fallback={
        <p className="text-xs" style={META}>
          Loading QBR deck studio…
        </p>
      }
    >
      <DecksList
        {...props}
        fetchKey={fetchKey}
        bump={() => setFetchKey((k) => k + 1)}
      />
    </Suspense>
  );
};

export default BuyerPitchDeckShareCard;
