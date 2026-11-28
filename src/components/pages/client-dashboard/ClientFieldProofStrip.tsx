import { useCallback, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link, useNavigate } from "react-router";
import { Eye, Pin } from "lucide-react";
import { ReportsFieldPhotosQuery } from "@/api/queries/ReportsFieldPhotosQuery";
import type { ReportsFieldPhotosQuery as ReportsFieldPhotosQueryType } from "@api/queries/__generated__/ReportsFieldPhotosQuery.graphql";
import { executeAuthenticatedGraphQL } from "@/api/relay/environment";
import SparkThumb from "@/shared/SparkThumb";
import { PhotoLightbox, type PhotoLightboxItem } from "@/shared/PhotoLightbox";
import { LikeBurst } from "@/motion/LikeBurst";
import { RecapQuickPeekSheet } from "@/recap/RecapQuickPeekSheet";
import { buildPublicRecapShareUrl } from "@/recap/recapQuickPeek";
import { useAlertStore } from "@/store/alertStore";
import { cleanEventName, formatEventDate } from "@/utils/eventLabel";
import { pickFieldPhoto } from "@/utils/fieldPhoto";
import { thumbUrl } from "@/utils/thumb";
import {
  buildClientProofQuickPeekItem,
  loadLocalPinnedUrls,
  saveLocalPinnedUrls,
  type ProofRecapMetrics,
} from "./clientProofHelpers";

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

type ProofFrame = {
  recapId: string;
  uuid: string;
  url: string;
  original: string;
  retailerName: string;
  stateCode: string | null;
  storeLabel: string;
  rawDate: string;
  dateLabel: string;
  categoryLabel: string;
  fileCount: number;
};

const PHOTO_WALL_PINS_QUERY = `
  query ClientProofWallPins($startDate: String, $endDate: String) {
    photoWall(startDate: $startDate, endDate: $endDate, pinnedOnly: false, first: 48, offset: 0) {
      photos {
        id
        url
        recapUuid
        isPinned
      }
    }
  }
`;

const TOGGLE_PIN_MUTATION = `
  mutation ClientProofTogglePin($photoId: String!, $pinned: Boolean) {
    togglePhotoWallPin(photoId: $photoId, pinned: $pinned) {
      ok
      isPinned
    }
  }
`;

const PROOF_RECAP_METRICS_QUERY = `
  query ClientProofRecapPeek($uuid: ID) {
    customRecap(uuid: $uuid) {
      id
      name
      approved
      totalEngagements
      consumersSampled
      soldUnits
      customRecapFilesCount
      shareToken
      sharedAt
    }
  }
`;

/**
 * 4-up editorial contact strip on the Client Dashboard: real approved setup
 * and sampling frames with in-place PhotoLightbox, 1-click LikeBurst Pin to
 * Deck, and RecapQuickPeekSheet (with multi-photo filmstrip + Copy link).
 */
export function ClientFieldProofStrip({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 90);
    return { startDate: ymd(start), endDate: ymd(end) };
  }, []);

  const photoData = useLazyLoadQuery<ReportsFieldPhotosQueryType>(
    ReportsFieldPhotosQuery,
    {
      first: 32,
      filters: { tenantId, startDate, endDate, approved: true },
    },
    { fetchPolicy: "store-or-network" },
  );

  const frames = useMemo(() => {
    const candidates: ProofFrame[] = [];
    for (const edge of photoData?.customRecaps?.edges ?? []) {
      const node = edge?.node;
      if (!node) continue;
      const files = node.customRecapFiles ?? [];
      const src = pickFieldPhoto(files);
      if (!src) continue;
      const matchedFile = files.find(
        (f) => f?.displayUrl === src || f?.url === src,
      );
      const rawCat = matchedFile?.fileRecapCategory?.name?.trim() ?? "";
      const cleanStore = cleanEventName(node.eventRetailer);
      const storeLabel =
        [cleanStore, node.eventState].filter(Boolean).join(", ") ||
        "Field activation";
      candidates.push({
        recapId: String(node.id),
        uuid: String(node.uuid),
        url: thumbUrl(src, 800) || src,
        original: src,
        retailerName: cleanStore || "Field activation",
        stateCode: node.eventState ?? null,
        storeLabel,
        rawDate: node.eventDate ?? "",
        dateLabel: formatEventDate(node.eventDate),
        categoryLabel: rawCat && !/receipt|expense/i.test(rawCat) ? rawCat : "",
        fileCount: files.length,
      });
    }

    const distinct: ProofFrame[] = [];
    const overflow: ProofFrame[] = [];
    const seenStores = new Set<string>();
    for (const item of candidates) {
      const key = item.storeLabel.toLowerCase();
      if (seenStores.has(key)) {
        overflow.push(item);
      } else {
        seenStores.add(key);
        distinct.push(item);
      }
    }
    return [...distinct, ...overflow].slice(0, 4);
  }, [photoData]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const [metricsByUuid, setMetricsByUuid] = useState<
    Record<string, ProofRecapMetrics>
  >({});
  const [wallMap, setWallMap] = useState<
    Record<string, { photoId: string; isPinned: boolean }>
  >({});
  const [localPins, setLocalPins] = useState<Set<string>>(() =>
    loadLocalPinnedUrls(tenantId),
  );

  useEffect(() => {
    setLocalPins(loadLocalPinnedUrls(tenantId));
  }, [tenantId]);

  // Match frames against Photo Wall IDs so Pin to Deck syncs server-side when permitted.
  useEffect(() => {
    if (frames.length === 0) return;
    let cancelled = false;
    executeAuthenticatedGraphQL<{
      photoWall?: {
        photos?: ReadonlyArray<{
          id: string;
          url: string;
          recapUuid?: string | null;
          isPinned: boolean;
        }>;
      } | null;
    }>(
      PHOTO_WALL_PINS_QUERY,
      { startDate, endDate },
      { operationKind: "query" },
    )
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, { photoId: string; isPinned: boolean }> = {};
        for (const p of res.data?.photoWall?.photos ?? []) {
          if (p.recapUuid && !next[p.recapUuid]) {
            next[p.recapUuid] = { photoId: p.id, isPinned: p.isPinned };
          }
          if (p.url) {
            next[p.url] = { photoId: p.id, isPinned: p.isPinned };
          }
        }
        setWallMap(next);
      })
      .catch(() => {
        /* localStorage fallback still works */
      });
    return () => {
      cancelled = true;
    };
  }, [frames.length, startDate, endDate, tenantId]);

  const isFramePinned = useCallback(
    (frame: ProofFrame): boolean => {
      const serverMatch = wallMap[frame.original] ?? wallMap[frame.uuid];
      if (serverMatch) {
        return serverMatch.isPinned || localPins.has(frame.original);
      }
      return localPins.has(frame.original);
    },
    [wallMap, localPins],
  );

  const togglePinFrame = useCallback(
    async (frame: ProofFrame) => {
      const currentlyPinned = isFramePinned(frame);
      const nextPinned = !currentlyPinned;

      setLocalPins((prev) => {
        const next = new Set(prev);
        if (nextPinned) next.add(frame.original);
        else next.delete(frame.original);
        saveLocalPinnedUrls(tenantId, next);
        return next;
      });

      const serverMatch = wallMap[frame.original] ?? wallMap[frame.uuid];
      if (serverMatch?.photoId) {
        setWallMap((prev) => ({
          ...prev,
          [frame.original]: { ...serverMatch, isPinned: nextPinned },
          [frame.uuid]: { ...serverMatch, isPinned: nextPinned },
        }));
        try {
          await executeAuthenticatedGraphQL(
            TOGGLE_PIN_MUTATION,
            { photoId: serverMatch.photoId, pinned: nextPinned },
            { operationKind: "mutation" },
          );
        } catch {
          /* keep local pin state gracefully */
        }
      }

      showAlert(
        nextPinned
          ? "Pinned to Buyer Pitch Deck."
          : "Removed from pitch-deck pins.",
        "success",
      );
    },
    [isFramePinned, tenantId, wallMap, showAlert],
  );

  const activePeekFrame = peekIndex != null ? (frames[peekIndex] ?? null) : null;

  useEffect(() => {
    if (!activePeekFrame) return;
    const uuid = activePeekFrame.uuid;
    if (metricsByUuid[uuid]) return;
    let cancelled = false;
    executeAuthenticatedGraphQL<{ customRecap?: ProofRecapMetrics | null }>(
      PROOF_RECAP_METRICS_QUERY,
      { uuid },
      { operationKind: "query" },
    )
      .then((res) => {
        const cr = res.data?.customRecap;
        if (!cancelled && cr) {
          setMetricsByUuid((prev) => ({ ...prev, [uuid]: cr }));
        }
      })
      .catch(() => {
        /* fallback frame fields still render */
      });
    return () => {
      cancelled = true;
    };
  }, [activePeekFrame, metricsByUuid]);

  const lightboxPhotos: PhotoLightboxItem[] = useMemo(
    () =>
      frames.map((f) => ({
        url: f.original,
        thumb: thumbUrl(f.original, 400) || f.url,
        name: f.storeLabel,
        caption: [f.storeLabel, f.dateLabel, f.categoryLabel]
          .filter(Boolean)
          .join(" · "),
      })),
    [frames],
  );

  if (frames.length === 0) return null;

  const peekItem = activePeekFrame
    ? buildClientProofQuickPeekItem(
        activePeekFrame,
        metricsByUuid[activePeekFrame.uuid],
      )
    : null;

  return (
    <>
      <section className="spark-card p-5 sm:p-6" aria-label="Recent field proof">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-baseline gap-2.5">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--spark-text)", letterSpacing: "-0.015em" }}
            >
              Recent field proof
            </h2>
            <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
              Click to enlarge · Quick peek or pin to Buyer Deck
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <Link
              to="/photo-wall"
              className="no-underline hover:underline"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              Photo wall →
            </Link>
            <Link
              to="/recaps/list"
              className="no-underline hover:underline"
              style={{ color: "var(--spark-text-meta)" }}
            >
              All recaps
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {frames.map((frame, idx) => {
            const pinned = isFramePinned(frame);
            return (
              <div
                key={frame.uuid}
                className="group flex flex-col gap-2 min-w-0"
              >
                <div
                  className="relative w-full overflow-hidden rounded-[8px]"
                  style={{
                    aspectRatio: "4 / 3",
                    background: "var(--spark-surface-2)",
                    boxShadow:
                      "inset 0 0 0 1px var(--spark-hairline, var(--spark-border))",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    aria-label={`Enlarge photo from ${frame.storeLabel}`}
                    className="block w-full h-full p-0 border-0 bg-transparent cursor-zoom-in"
                  >
                    <SparkThumb
                      sources={[frame.url, frame.original]}
                      alt={`${frame.storeLabel}${frame.dateLabel ? ` on ${frame.dateLabel}` : ""}`}
                      className="transition-transform duration-300 ease-out group-hover:scale-[1.025]"
                    />
                  </button>

                  {/* 1-click Pin to Deck (LikeBurst) */}
                  <div
                    className={`absolute top-2 right-2 transition-opacity ${
                      pinned
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    }`}
                  >
                    <LikeBurst active={pinned}>
                      <button
                        type="button"
                        aria-pressed={pinned}
                        onClick={(e) => {
                          e.stopPropagation();
                          void togglePinFrame(frame);
                        }}
                        title={
                          pinned
                            ? "Pinned to Buyer Pitch Deck (click to unpin)"
                            : "Pin photo to Buyer Pitch Deck"
                        }
                        className="px-2 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                        style={
                          pinned
                            ? {
                                background: "var(--spark-lime)",
                                color: "var(--spark-on-accent)",
                                border: "1px solid var(--spark-lime)",
                              }
                            : {
                                background: "rgba(15, 19, 16, 0.72)",
                                color: "#f6f6f2",
                                border: "1px solid rgba(255,255,255,0.22)",
                                backdropFilter: "blur(6px)",
                              }
                        }
                      >
                        <Pin size={11} strokeWidth={2} />
                        <span>{pinned ? "Pinned" : "Pin"}</span>
                      </button>
                    </LikeBurst>
                  </div>

                  {/* Quick Peek slide-over trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPeekIndex(idx);
                    }}
                    title="Quick peek recap KPIs & multi-photo filmstrip"
                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 absolute bottom-2 right-2 px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                    style={{
                      background: "rgba(15, 19, 16, 0.75)",
                      color: "#f6f6f2",
                      border: "1px solid rgba(255,255,255,0.2)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <Eye size={11} strokeWidth={1.9} />
                    <span>Quick peek</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPeekIndex(idx)}
                  className="min-w-0 px-0.5 text-left bg-transparent border-0 p-0 cursor-pointer"
                  title={`Quick peek recap · ${frame.storeLabel}`}
                >
                  <p
                    className="text-[13px] font-medium truncate group-hover:underline m-0"
                    style={{
                      color: "var(--spark-text)",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    {frame.storeLabel}
                  </p>
                  <p
                    className="text-xs truncate tab-num mt-0.5 mb-0"
                    style={{ color: "var(--spark-text-meta)" }}
                  >
                    {[frame.dateLabel, frame.categoryLabel]
                      .filter(Boolean)
                      .join(" · ") || "Approved recap"}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {lightboxIndex != null && lightboxPhotos.length > 0 ? (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          loop={lightboxPhotos.length > 1}
          onClose={() => setLightboxIndex(null)}
          onStep={setLightboxIndex}
        />
      ) : null}

      <RecapQuickPeekSheet
        recap={peekItem}
        open={peekItem !== null}
        onOpenChange={(next) => {
          if (!next) setPeekIndex(null);
        }}
        index={peekIndex ?? 0}
        total={frames.length}
        onPrev={() =>
          setPeekIndex((cur) => (cur != null && cur > 0 ? cur - 1 : cur))
        }
        onNext={() =>
          setPeekIndex((cur) =>
            cur != null && cur < frames.length - 1 ? cur + 1 : cur,
          )
        }
        isClient
        onCopyShareLink={async (item) => {
          const url = buildPublicRecapShareUrl(
            window.location.origin,
            item.shareToken,
          );
          if (!url) return;
          try {
            await navigator.clipboard.writeText(url);
            showAlert("Public recap share link copied.", "success");
          } catch {
            showAlert(url, "info");
          }
        }}
        onOpenFull={(item) => {
          setPeekIndex(null);
          navigate(`/recap/view-custom/${item.uuid}`);
        }}
      />
    </>
  );
}

export default ClientFieldProofStrip;
