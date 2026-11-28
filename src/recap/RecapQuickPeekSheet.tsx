import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SparkSheet from "@/shared/SparkSheet";
import useBaLabel from "@/hooks/useBaLabel";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import { StatusMorph } from "@/motion/StatusMorph";
import {
  recapActivationFilterLabel,
  type RecapTypeKey,
} from "@/lib/activationBucket";
import { recapConversionPercent } from "@/shared/sparkStat";
import { recapIsEmptyShell } from "./recapListFilters";
import { recapRowStatus } from "./recapRowStatus";
import { NeedsEyesWhy } from "./NeedsEyesWhy";
import { RecapReviewFlagBadges } from "./RecapReviewFlagBadges";
import type { ReviewFlagSummary } from "./reviewCheckDisplay";
import { resolveRecapQuickPeekKey } from "./recapQuickPeek";
import { useQuickPeekPhotos } from "./useQuickPeekPhotos";

export interface RecapQuickPeekItem {
  kind: "legacy" | "custom";
  id: string;
  uuid: string;
  name: string;
  date: string;
  retailerName: string;
  stateCode: string | null;
  approved: boolean;
  approvalMeta: string | null;
  heroImage: string | null;
  fileCount: number;
  engagements: number | null;
  consumersSampled: number | null;
  productsSold: number | null;
  isDryDemo: boolean;
  peopleEngaged: number | null;
  cansSold: number | null;
  packsSold: number | null;
  accountSpendAmount: number | null;
  baName: string;
  isExternalBa: boolean;
  isThirdParty: boolean;
  excludeFromAggregates: boolean;
  sourceLabel: string;
  recapType: RecapTypeKey;
  requestUuid: string | null;
  requestShortId: string | null;
  shareToken: string | null;
  sharedAt: string | null;
  archivedAt: string | null;
}

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

export function RecapQuickPeekSheet({
  recap,
  open,
  onOpenChange,
  index,
  total,
  onPrev,
  onNext,
  isClient,
  allowClientApprove = false,
  forceApproved = false,
  approving = false,
  onApprove,
  onApproveAndNext,
  onCopyShareLink,
  onOpenShareModal,
  onOpenFull,
  onOpenRequest,
  reviewFlags,
  needsEyesWhy,
}: {
  recap: RecapQuickPeekItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  isClient: boolean;
  allowClientApprove?: boolean;
  forceApproved?: boolean;
  approving?: boolean;
  onApprove?: (recap: RecapQuickPeekItem) => void;
  onApproveAndNext?: (recap: RecapQuickPeekItem) => void;
  onCopyShareLink?: (recap: RecapQuickPeekItem) => Promise<void> | void;
  onOpenShareModal?: (recap: RecapQuickPeekItem) => void;
  onOpenFull: (recap: RecapQuickPeekItem) => void;
  onOpenRequest?: (requestUuid: string) => void;
  reviewFlags?: readonly ReviewFlagSummary[] | null;
  needsEyesWhy?: string | null;
}) {
  const baLabel = useBaLabel();
  const [copiedShare, setCopiedShare] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const { photos, loadingPhotos } = useQuickPeekPhotos(recap, open);

  useEffect(() => {
    setCopiedShare(false);
    setHeroFailed(false);
    setPhotoIndex(0);
  }, [recap?.uuid]);

  const emptyShell = recap ? recapIsEmptyShell(recap) : false;
  const approved = Boolean(recap?.approved || forceApproved);
  const canApprove = Boolean(
    recap &&
      (!isClient || allowClientApprove) &&
      !approved &&
      !emptyShell &&
      onApprove &&
      !approving,
  );
  const canShare = Boolean(recap?.shareToken && onCopyShareLink);
  const hasMultiplePhotos = photos.length > 1;

  const handleCopyShare = useCallback(async () => {
    if (!recap || !onCopyShareLink || !recap.shareToken) return;
    await onCopyShareLink(recap);
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 1800);
  }, [recap, onCopyShareLink]);

  const handleApproveAndNext = useCallback(
    (item: RecapQuickPeekItem) => {
      if (onApproveAndNext) {
        onApproveAndNext(item);
        return;
      }
      if (onApprove) {
        onApprove(item);
        if (index < total - 1) onNext();
      }
    },
    [onApproveAndNext, onApprove, index, total, onNext],
  );

  useEffect(() => {
    if (!open || !recap) return;
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      const action = resolveRecapQuickPeekKey({
        key: e.key,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        isTypingTarget: isTypingTarget(e.target),
        canApprove,
        canShare,
        hasMultiplePhotos,
      });
      if (!action) return;
      e.preventDefault();
      if (action === "next") onNext();
      else if (action === "prev") onPrev();
      else if (action === "photo_prev") {
        setPhotoIndex((cur) => (cur <= 0 ? photos.length - 1 : cur - 1));
      } else if (action === "photo_next") {
        setPhotoIndex((cur) => (cur >= photos.length - 1 ? 0 : cur + 1));
      } else if (action === "approve_and_next") handleApproveAndNext(recap);
      else if (action === "approve" && onApprove) onApprove(recap);
      else if (action === "share") void handleCopyShare();
      else if (action === "open_full") onOpenFull(recap);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    recap,
    canApprove,
    canShare,
    hasMultiplePhotos,
    photos.length,
    onNext,
    onPrev,
    onApprove,
    handleApproveAndNext,
    handleCopyShare,
    onOpenFull,
  ]);

  if (!recap) return null;

  const status = recapRowStatus({
    emptyShell,
    approved,
    sharedAt: recap.sharedAt,
    archivedAt: recap.archivedAt,
    isClient,
  });
  const convValue = recapConversionPercent(
    { ...recap, requestType: null },
    "—",
  );
  const shortCode = `R-${recap.uuid.slice(-4).toUpperCase()}`;
  const hasRetailer = Boolean(recap.retailerName && recap.retailerName !== "—");
  const secondaryMetrics = [
    recap.cansSold != null ? `${recap.cansSold.toLocaleString()} cans` : null,
    recap.packsSold != null ? `${recap.packsSold.toLocaleString()} packs` : null,
    recap.accountSpendAmount != null
      ? `$${recap.accountSpendAmount.toFixed(2)} spend`
      : null,
  ].filter(Boolean);

  const safePhotoIndex =
    photos.length > 0 ? Math.min(photoIndex, photos.length - 1) : 0;
  const activePhoto = photos[safePhotoIndex] ?? null;
  const displayHeroUrl = activePhoto?.url ?? recap.heroImage;
  const totalPhotoDisplay = Math.max(photos.length, recap.fileCount);

  return (
    <SparkSheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      eyebrow={`Recap quick peek · ${shortCode}`}
      title={recap.name}
      headerActions={
        total > 1 ? (
          <div className="inline-flex items-center gap-1">
            <span
              className="text-xs tab-num mr-1"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={onPrev}
              disabled={index <= 0}
              aria-label="Previous recap"
              title="Previous recap (k)"
              className="px-2 py-1 rounded-md text-xs font-medium disabled:opacity-35 transition"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text-secondary)",
                background: "transparent",
              }}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={index >= total - 1}
              aria-label="Next recap"
              title="Next recap (j)"
              className="px-2 py-1 rounded-md text-xs font-medium disabled:opacity-35 transition"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text-secondary)",
                background: "transparent",
              }}
            >
              ↓
            </button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col h-full min-h-[68dvh] justify-between gap-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`chip ${
                status.tone === "attention"
                  ? "chip-orange"
                  : status.tone === "done"
                    ? "chip-lime"
                    : "chip-muted"
              }`}
            >
              <StatusMorph value={status.text} />
            </span>
            <span className="chip chip-muted">
              {recapActivationFilterLabel(recap.recapType)}
            </span>
            {recap.fileCount > 0 ? (
              <span className="chip chip-muted tab-num">
                {recap.fileCount} {recap.fileCount === 1 ? "photo" : "photos"}
              </span>
            ) : null}
          </div>

          {!isClient && !emptyShell && !approved ? (
            <div>
              <RecapReviewFlagBadges flags={reviewFlags} />
              <NeedsEyesWhy text={needsEyesWhy ?? null} />
            </div>
          ) : null}

          {displayHeroUrl && !heroFailed ? (
            <div className="space-y-2">
              <div
                className="relative overflow-hidden rounded-xl group"
                style={{
                  aspectRatio: "16 / 10",
                  border: "1px solid var(--spark-border)",
                  background: "rgba(var(--spark-ink-rgb),0.04)",
                }}
              >
                <img
                  src={displayHeroUrl}
                  alt={activePhoto?.label || recap.name}
                  className="w-full h-full object-cover"
                  onError={() => setHeroFailed(true)}
                />
                {activePhoto?.category ? (
                  <span
                    className="absolute left-2.5 bottom-2.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium"
                    style={{
                      background: "rgba(15, 19, 16, 0.72)",
                      color: "#f6f6f2",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    {activePhoto.category}
                  </span>
                ) : null}
                {totalPhotoDisplay > 1 ? (
                  <span
                    className="absolute right-2.5 top-2.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold tab-num"
                    style={{
                      background: "rgba(15, 19, 16, 0.72)",
                      color: "#f6f6f2",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    {safePhotoIndex + 1} / {totalPhotoDisplay}
                  </span>
                ) : null}
                {hasMultiplePhotos ? (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo"
                      title="Previous photo (←)"
                      onClick={() =>
                        setPhotoIndex((cur) =>
                          cur <= 0 ? photos.length - 1 : cur - 1,
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition opacity-85 hover:opacity-100"
                      style={{
                        background: "rgba(15, 19, 16, 0.68)",
                        color: "#f6f6f2",
                        border: "1px solid rgba(255,255,255,0.18)",
                      }}
                    >
                      <ChevronLeft size={15} strokeWidth={2.1} />
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      title="Next photo (→)"
                      onClick={() =>
                        setPhotoIndex((cur) =>
                          cur >= photos.length - 1 ? 0 : cur + 1,
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition opacity-85 hover:opacity-100"
                      style={{
                        background: "rgba(15, 19, 16, 0.68)",
                        color: "#f6f6f2",
                        border: "1px solid rgba(255,255,255,0.18)",
                      }}
                    >
                      <ChevronRight size={15} strokeWidth={2.1} />
                    </button>
                  </>
                ) : null}
              </div>

              {hasMultiplePhotos ? (
                <div
                  role="listbox"
                  aria-label="Recap photo filmstrip"
                  className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scroll"
                >
                  {photos.map((p, idx) => {
                    const selected = idx === safePhotoIndex;
                    return (
                      <button
                        key={`${p.url}-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setHeroFailed(false);
                          setPhotoIndex(idx);
                        }}
                        title={p.category || `Photo ${idx + 1}`}
                        className="relative shrink-0 w-14 h-10 rounded-lg overflow-hidden cursor-pointer transition"
                        style={{
                          border: selected
                            ? "2px solid var(--spark-lime)"
                            : "1px solid var(--spark-border)",
                          opacity: selected ? 1 : 0.68,
                          padding: 0,
                          background: "var(--spark-surface-2)",
                        }}
                      >
                        <img
                          src={p.thumb}
                          alt={p.label}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              ) : loadingPhotos && recap.fileCount > 1 ? (
                <p
                  className="text-[11px] mono"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  Loading {recap.fileCount} photos…
                </p>
              ) : null}
            </div>
          ) : emptyShell ? (
            <div
              className="rounded-xl p-4 text-sm"
              style={{
                border: "1px dashed var(--spark-border)",
                color: "var(--spark-text-meta)",
              }}
            >
              Ambassador clocked out without filing recap metrics or photos yet.
            </div>
          ) : (
            <div
              className="rounded-xl p-4 text-xs flex items-center justify-between"
              style={{
                border: "1px solid var(--spark-border)",
                background: "rgba(var(--spark-ink-rgb),0.025)",
                color: "var(--spark-text-meta)",
              }}
            >
              <span>No hero photo attached</span>
              <span>Open full recap to inspect all fields</span>
            </div>
          )}

          {!emptyShell ? (
            <div className="recap-kpi-strip">
              <div className="recap-kpi-cell">
                <p className="recap-kpi-label">Engagements</p>
                <p className="recap-kpi-value">
                  {recap.engagements != null
                    ? recap.engagements.toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="recap-kpi-cell">
                <p className="recap-kpi-label">Units sold</p>
                <p className="recap-kpi-value">
                  {recap.productsSold != null
                    ? recap.productsSold.toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="recap-kpi-cell">
                <p className="recap-kpi-label">Conversion</p>
                <p className="recap-kpi-value">{convValue}</p>
              </div>
            </div>
          ) : null}

          {secondaryMetrics.length > 0 ? (
            <p
              className="text-xs tab-num"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {secondaryMetrics.join(" · ")}
            </p>
          ) : null}

          <div className="spark-inset-group">
            <div className="spark-inset-row justify-between text-sm">
              <span style={{ color: "var(--spark-text-meta)" }}>Event date</span>
              <span className="font-medium tab-num">{fmtDate(recap.date)}</span>
            </div>
            <div className="spark-inset-row justify-between text-sm">
              <span style={{ color: "var(--spark-text-meta)" }}>Store</span>
              {hasRetailer ? (
                <button
                  type="button"
                  onClick={() => {
                    useStoreSheetStore.getState().openStoreSheet({
                      recapId: recap.uuid,
                      storeName: recap.retailerName,
                      fallbackTitle: recap.retailerName,
                    });
                  }}
                  className="font-medium underline underline-offset-2 text-right truncate max-w-[65%]"
                  style={{ color: "var(--spark-text)" }}
                >
                  {recap.retailerName}
                  {recap.stateCode ? ` · ${recap.stateCode}` : ""}
                </button>
              ) : (
                <span className="font-medium">
                  {recap.stateCode || "Walk-in / Event"}
                </span>
              )}
            </div>
            <div className="spark-inset-row justify-between text-sm">
              <span style={{ color: "var(--spark-text-meta)" }}>Ambassador</span>
              <span className="font-medium">
                {baLabel(recap.baName) || "Unattributed"}
              </span>
            </div>
            {recap.requestUuid && onOpenRequest ? (
              <div className="spark-inset-row justify-between text-sm">
                <span style={{ color: "var(--spark-text-meta)" }}>Request</span>
                <button
                  type="button"
                  onClick={() => onOpenRequest(recap.requestUuid!)}
                  className="font-medium underline underline-offset-2"
                  style={{ color: "var(--spark-text)" }}
                >
                  {recap.requestShortId ?? "Open request"} ↗
                </button>
              </div>
            ) : null}
            {recap.approvalMeta ? (
              <div className="spark-inset-row justify-between text-xs">
                <span style={{ color: "var(--spark-text-meta)" }}>Review</span>
                <span style={{ color: "var(--spark-ok-ink)" }}>
                  {recap.approvalMeta}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="pt-3 flex flex-wrap items-center gap-2"
          style={{
            borderTop: "1px solid var(--spark-hairline, var(--spark-border))",
          }}
        >
          {(!isClient || allowClientApprove) && !approved && !emptyShell && onApprove ? (
            <>
              <button
                type="button"
                disabled={approving}
                onClick={() => onApprove(recap)}
                className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition disabled:opacity-50"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }}
              >
                <span>{approving ? "Approving…" : "Approve"}</span>
                <kbd className="mono text-[10px] opacity-75 px-1.5 py-0.5 rounded bg-black/15">
                  A
                </kbd>
              </button>
              {total > 1 && index < total - 1 ? (
                <button
                  type="button"
                  disabled={approving}
                  onClick={() => handleApproveAndNext(recap)}
                  title="Approve this recap and jump to the next in queue (Shift+A)"
                  className="px-3.5 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition disabled:opacity-50"
                  style={{
                    border: "1px solid var(--spark-lime)",
                    color: "var(--spark-text)",
                    background: "rgba(var(--spark-accent-rgb), 0.12)",
                  }}
                >
                  <span>Approve &amp; next</span>
                  <kbd className="mono text-[10px] opacity-75 px-1.5 py-0.5 rounded border border-[var(--spark-border)]">
                    ⇧A
                  </kbd>
                </button>
              ) : null}
            </>
          ) : null}

          {recap.shareToken && onCopyShareLink ? (
            <button
              type="button"
              onClick={() => void handleCopyShare()}
              className="px-3.5 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                background: "transparent",
              }}
            >
              <span>{copiedShare ? "✓ Link copied" : "Copy link"}</span>
              <kbd className="mono text-[10px] opacity-65 px-1.5 py-0.5 rounded border border-[var(--spark-border)]">
                S
              </kbd>
            </button>
          ) : null}

          {recap.shareToken && onOpenShareModal ? (
            <button
              type="button"
              onClick={() => onOpenShareModal(recap)}
              className="px-3 py-2 rounded-lg text-sm font-medium transition"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text-secondary)",
                background: "transparent",
              }}
            >
              Email…
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenFull(recap)}
            className="ml-auto px-3.5 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition"
            style={{
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              background: "rgba(var(--spark-ink-rgb),0.04)",
            }}
          >
            <span>Open full recap ↗</span>
            <kbd className="mono text-[10px] opacity-65">↵</kbd>
          </button>
        </div>
      </div>
    </SparkSheet>
  );
}

export default RecapQuickPeekSheet;
