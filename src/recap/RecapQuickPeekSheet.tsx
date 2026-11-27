import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    setCopiedShare(false);
    setHeroFailed(false);
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

  const handleCopyShare = useCallback(async () => {
    if (!recap || !onCopyShareLink || !recap.shareToken) return;
    await onCopyShareLink(recap);
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 1800);
  }, [recap, onCopyShareLink]);

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
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        isTypingTarget: isTypingTarget(e.target),
        canApprove,
        canShare,
      });
      if (!action) return;
      e.preventDefault();
      if (action === "next") onNext();
      else if (action === "prev") onPrev();
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
    onNext,
    onPrev,
    onApprove,
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
              ● <StatusMorph value={status.text} />
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

          {recap.heroImage && !heroFailed ? (
            <div
              className="relative overflow-hidden rounded-xl"
              style={{
                aspectRatio: "16 / 10",
                border: "1px solid var(--spark-border)",
                background: "rgba(var(--spark-ink-rgb),0.04)",
              }}
            >
              <img
                src={recap.heroImage}
                alt={recap.name}
                className="w-full h-full object-cover"
                onError={() => setHeroFailed(true)}
              />
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
          {!isClient && !approved && !emptyShell && onApprove ? (
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
