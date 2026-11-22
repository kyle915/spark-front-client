import React, { Suspense, useEffect, useMemo, useState } from "react";
import { fetchQuery } from "relay-runtime";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Link } from "react-router";
import environment from "@/api/relay/environment";
import { PitchDeckQueriesPhotoWallQuery } from "@/api/queries/PitchDeckQueries";
import type { PitchDeckQueriesPhotoWallQuery as PhotoWallQueryType } from "@/api/queries/__generated__/PitchDeckQueriesPhotoWallQuery.graphql";
import { PitchDeckMutationsTogglePinMutation } from "@/api/mutations/PitchDeckMutations";
import type { PitchDeckMutationsTogglePinMutation as TogglePinType } from "@/api/mutations/__generated__/PitchDeckMutationsTogglePinMutation.graphql";
import { PhotoLightbox, type PhotoLightboxItem } from "@/shared/PhotoLightbox";
import { thumbUrl } from "@/utils/thumb";

const PAGE_SIZE = 60;

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
const PINNED_BTN_STYLE = {
  background: "var(--spark-surface-2, var(--spark-surface))",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
} as const;

type PhotoRow = PhotoWallQueryType["response"]["photoWall"]["photos"][number];

const PhotoWallBody: React.FC<{
  retailer: string;
  market: string;
  sku: string;
  category: string;
  search: string;
  pinnedOnly: boolean;
  fetchKey: number;
  bump: () => void;
}> = ({
  retailer,
  market,
  sku,
  category,
  search,
  pinnedOnly,
  fetchKey,
  bump,
}) => {
  const vars = {
    startDate: null as string | null,
    endDate: null as string | null,
    retailer: retailer || null,
    market: market || null,
    sku: sku || null,
    category: category || null,
    search: search || null,
    pinnedOnly,
    first: PAGE_SIZE,
    offset: 0,
  };
  const data = useLazyLoadQuery<PhotoWallQueryType>(
    PitchDeckQueriesPhotoWallQuery,
    vars,
    { fetchPolicy: "network-only", fetchKey },
  );
  const wall = data.photoWall;
  const [photos, setPhotos] = useState<PhotoRow[]>(() => [...wall.photos]);
  const [total, setTotal] = useState(wall.total);
  const [pinnedCount, setPinnedCount] = useState(wall.pinnedCount);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commitPin, pinInFlight] = useMutation<TogglePinType>(
    PitchDeckMutationsTogglePinMutation,
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    setPhotos([...wall.photos]);
    setTotal(wall.total);
    setPinnedCount(wall.pinnedCount);
    setLightboxIndex(null);
  }, [wall, fetchKey]);

  const lightboxPhotos: PhotoLightboxItem[] = useMemo(
    () =>
      photos.map((p) => ({
        url: p.url,
        thumb: thumbUrl(p.url, 400) || p.url,
        caption: [p.store, p.category, p.caption].filter(Boolean).join(" · "),
        name: p.store || p.category,
      })),
    [photos],
  );

  const togglePin = (photoId: string, currentlyPinned: boolean) => {
    commitPin({
      variables: { photoId, pinned: !currentlyPinned },
      onCompleted: (res) => {
        const out = res.togglePhotoWallPin;
        if (!out?.ok) {
          setBanner(out?.error || "Could not update pin.");
          return;
        }
        setBanner(
          out.isPinned
            ? "Pinned for Buyer Pitch Decks."
            : "Removed from pitch-deck pins.",
        );
        bump();
      },
      onError: () => setBanner("Could not update pin."),
    });
  };

  const loadMore = async () => {
    if (loadingMore || photos.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await fetchQuery<PhotoWallQueryType>(
        environment,
        PitchDeckQueriesPhotoWallQuery,
        { ...vars, offset: photos.length, first: PAGE_SIZE },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const next = res?.photoWall;
      if (next) {
        setTotal(next.total);
        setPinnedCount(next.pinnedCount);
        setPhotos((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const appended = next.photos.filter((p) => !seen.has(p.id));
          return [...prev, ...appended];
        });
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = photos.length < total;

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider mono" style={META}>
            Live In-Store Photo Wall
          </p>
          <h1
            className="display text-2xl lg:text-3xl font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Curate demo proof for buyer decks
          </h1>
          <p className="text-xs mt-1" style={META}>
            Showing <strong className="mono">{photos.length}</strong> of{" "}
            <strong className="mono">{total}</strong> photos ·{" "}
            <strong className="mono">{pinnedCount}</strong> pinned ·{" "}
            <Link to="/buyer-report" className="underline underline-offset-2">
              Build a Buyer Pitch Deck
            </Link>
          </p>
        </div>
      </header>

      {banner && (
        <div
          className="p-3 rounded-xl text-xs"
          style={{
            background: "var(--spark-ok-bg)",
            color: "var(--spark-ok-ink)",
            border: "1px solid var(--spark-ok-border)",
          }}
        >
          {banner}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo, idx) => (
          <article
            key={photo.id}
            className="rounded-xl overflow-hidden flex flex-col"
            style={{ border: "1px solid var(--spark-border)" }}
          >
            <button
              type="button"
              className="relative aspect-[4/3] bg-black/20"
              onClick={() => setLightboxIndex(idx)}
            >
              <img
                src={thumbUrl(photo.url, 400) || photo.url}
                alt={photo.caption || photo.store || "In-store photo"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
            <div className="p-2.5 space-y-1.5 flex-1 flex flex-col">
              <p className="text-xs font-semibold leading-snug line-clamp-2">
                {photo.store || photo.retailer || "Store"}
              </p>
              <p className="text-[11px] line-clamp-1" style={META}>
                {[photo.retailer, photo.market, photo.eventDate]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-[11px] line-clamp-1" style={META}>
                {photo.category}
                {photo.skus.length ? ` · ${photo.skus.slice(0, 2).join(", ")}` : ""}
              </p>
              <button
                type="button"
                disabled={pinInFlight}
                onClick={() => togglePin(photo.id, photo.isPinned)}
                className="mt-auto w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                style={photo.isPinned ? PINNED_BTN_STYLE : PRIMARY_BTN_STYLE}
              >
                {photo.isPinned ? "Unpin from deck" : "Pin to Buyer Pitch Deck"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {photos.length === 0 && (
        <p className="text-sm" style={META}>
          No approved in-store demo photos match these filters yet.
        </p>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={PRIMARY_BTN_STYLE}
          >
            {loadingMore
              ? "Loading…"
              : `Load more (${Math.min(PAGE_SIZE, total - photos.length)} of ${
                  total - photos.length
                } remaining)`}
          </button>
        </div>
      )}

      {lightboxIndex !== null && lightboxPhotos[lightboxIndex] && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onStep={setLightboxIndex}
        />
      )}
    </div>
  );
};

export const PhotoWallPage: React.FC = () => {
  const [retailer, setRetailer] = useState("");
  const [market, setMarket] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="spark-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        <input
          value={retailer}
          onChange={(e) => {
            setRetailer(e.target.value);
            setFetchKey((k) => k + 1);
          }}
          placeholder="Retailer / store…"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={market}
          onChange={(e) => {
            setMarket(e.target.value);
            setFetchKey((k) => k + 1);
          }}
          placeholder="Market / state…"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            setFetchKey((k) => k + 1);
          }}
          placeholder="SKU / product…"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setFetchKey((k) => k + 1);
          }}
          placeholder="Photo category…"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFetchKey((k) => k + 1);
          }}
          placeholder="Search captions / stores…"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <label className="flex items-center gap-2 px-1 text-xs" style={META}>
          <input
            type="checkbox"
            checked={pinnedOnly}
            onChange={(e) => {
              setPinnedOnly(e.target.checked);
              setFetchKey((k) => k + 1);
            }}
          />
          Pinned only
        </label>
      </div>

      <Suspense
        fallback={
          <p className="text-sm" style={META}>
            Loading photo wall…
          </p>
        }
      >
        <PhotoWallBody
          retailer={retailer}
          market={market}
          sku={sku}
          category={category}
          search={search}
          pinnedOnly={pinnedOnly}
          fetchKey={fetchKey}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default PhotoWallPage;
