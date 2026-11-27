import React, { useEffect } from "react";
import {
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Pencil,
  Store,
  User,
  X,
} from "lucide-react";
import SparkSheet from "@/shared/SparkSheet";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import {
  resolveQuickPeekKeyAction,
  type QuickPeekItem,
} from "./quickPeekNav";

const STATUS_TONE: Record<string, string> = {
  done: "chip chip-lime",
  scheduled: "chip chip-sky",
  approved: "chip chip-purple",
  queue: "chip chip-gold",
  pending: "chip chip-orange",
};

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

export const RequestQuickPeekSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: QuickPeekItem | null;
  index: number;
  total: number;
  onStep: (delta: 1 | -1) => void;
  onOpenFull: (item: QuickPeekItem) => void;
  onEdit?: (item: QuickPeekItem) => void;
  onApprove?: (item: QuickPeekItem) => void;
  onDecline?: (item: QuickPeekItem) => void;
  approving?: boolean;
  enableHotkeys?: boolean;
  extraContent?: React.ReactNode;
}> = ({
  open,
  onOpenChange,
  item,
  index,
  total,
  onStep,
  onOpenFull,
  onEdit,
  onApprove,
  onDecline,
  approving = false,
  enableHotkeys = true,
  extraContent,
}) => {
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);

  useEffect(() => {
    if (!open || !item || !enableHotkeys) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;
      const action = resolveQuickPeekKeyAction(e.key, {
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
      });
      if (!action) return;
      if (action === "next") {
        e.preventDefault();
        onStep(1);
      } else if (action === "prev") {
        e.preventDefault();
        onStep(-1);
      } else if (
        action === "approve" &&
        item.canApprove &&
        !item.isApprovedOptimistic &&
        onApprove
      ) {
        e.preventDefault();
        onApprove(item);
      } else if (action === "decline" && onDecline) {
        e.preventDefault();
        onDecline(item);
      } else if (action === "open_full") {
        e.preventDefault();
        onOpenFull(item);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, item, enableHotkeys, onStep, onApprove, onDecline, onOpenFull]);

  if (!item) return null;

  const chipClass =
    STATUS_TONE[item.statusSlug.toLowerCase()] ?? "chip chip-muted";
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;
  const eyebrow =
    total > 0
      ? `${item.reqLabel} · ${index + 1} of ${total}`
      : item.reqLabel;

  return (
    <SparkSheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      size="md"
      eyebrow={eyebrow}
      title={item.venue || "Request preview"}
      headerActions={
        total > 1 ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => onStep(-1)}
              aria-label="Previous row (k)"
              title="Previous row (k)"
              className="w-8 h-8 rounded-lg grid place-items-center transition disabled:opacity-35"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                background: "transparent",
              }}
            >
              <ChevronUp size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => onStep(1)}
              aria-label="Next row (j)"
              title="Next row (j)"
              className="w-8 h-8 rounded-lg grid place-items-center transition disabled:opacity-35"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                background: "transparent",
              }}
            >
              <ChevronDown size={15} strokeWidth={1.75} />
            </button>
          </div>
        ) : null
      }
    >
      <div className="space-y-4 spark-scale">
        {/* Status & metadata pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${chipClass} chip-sm`}>
            {item.isApprovedOptimistic ? "Approved" : item.statusLabel}
          </span>
          {item.type && item.type !== "—" ? (
            <span className="chip chip-muted chip-sm">{item.type}</span>
          ) : null}
          {item.staffingSummary ? (
            <span className="chip chip-muted chip-sm">
              {item.staffingSummary}
            </span>
          ) : null}
          {item.recapSummary ? (
            <span
              className={`chip chip-sm ${
                item.recapSummary.toLowerCase().includes("due")
                  ? "chip-orange"
                  : "chip-lime"
              }`}
            >
              {item.recapSummary}
            </span>
          ) : null}
        </div>

        {/* Core facts card */}
        <div
          className="rounded-xl p-4 space-y-2.5 text-sm"
          style={{
            background: "var(--spark-surface-2, rgba(var(--spark-ink-rgb),0.03))",
            border: "1px solid var(--spark-border)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <Calendar
              size={15}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--spark-text-meta)" }}
            />
            <div>
              <p className="font-medium" style={{ color: "var(--spark-text)" }}>
                {item.dateLabel}
              </p>
              {item.timeLabel ? (
                <p
                  className="text-xs mt-0.5 inline-flex items-center gap-1"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  <Clock size={12} strokeWidth={1.75} />
                  {item.timeLabel}
                </p>
              ) : null}
            </div>
          </div>

          {(item.market || item.address) && (
            <div className="flex items-start gap-2.5">
              <MapPin
                size={15}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0"
                style={{ color: "var(--spark-text-meta)" }}
              />
              <div className="min-w-0">
                {item.market && item.market !== "—" ? (
                  <p
                    className="font-medium"
                    style={{ color: "var(--spark-text)" }}
                  >
                    {item.market}
                  </p>
                ) : null}
                {item.address ? (
                  <p
                    className="text-xs break-words"
                    style={{ color: "var(--spark-text-secondary)" }}
                  >
                    {item.address}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {item.requester && item.requester !== "—" ? (
            <div className="flex items-start gap-2.5">
              <User
                size={15}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0"
                style={{ color: "var(--spark-text-meta)" }}
              />
              <p
                className="text-xs"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Requested by <strong style={{ color: "var(--spark-text)" }}>{item.requester}</strong>
              </p>
            </div>
          ) : null}
        </div>

        {/* SKUs */}
        {item.skus && item.skus.length > 0 ? (
          <div>
            <p
              className="text-xs font-medium mb-1.5"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Products & SKUs ({item.skus.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.skus.map((sku) => (
                <span
                  key={sku}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{
                    background: "var(--spark-surface)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text-secondary)",
                  }}
                >
                  {sku}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {item.statusNote ? (
          <p
            className="text-xs rounded-xl px-3 py-2"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.03)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text-secondary)",
            }}
          >
            {item.statusNote}
          </p>
        ) : null}

        {/* Primary actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {item.canApprove && !item.isApprovedOptimistic && onApprove ? (
            <button
              type="button"
              disabled={approving}
              onClick={() => onApprove(item)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
              }}
            >
              <Check size={14} strokeWidth={1.75} />
              {approving ? "Approving…" : "Approve (a)"}
            </button>
          ) : null}

          {onDecline && !item.isApprovedOptimistic ? (
            <button
              type="button"
              disabled={approving}
              onClick={() => onDecline(item)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-flag-ink)",
                border: "1px solid rgba(210,72,27,0.4)",
              }}
            >
              <X size={14} strokeWidth={1.75} />
              Decline
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenFull(item)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
            style={
              item.canApprove && !item.isApprovedOptimistic && onApprove
                ? {
                    background: "transparent",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }
                : {
                    background: "var(--spark-lime)",
                    color: "var(--spark-on-accent)",
                  }
            }
          >
            Open full page
            <ArrowUpRight size={14} strokeWidth={1.75} />
          </button>

          {item.editHref && onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="px-3 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition"
              style={{
                background: "transparent",
                color: "var(--spark-text-secondary)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <Pencil size={13} strokeWidth={1.75} />
              Edit
            </button>
          ) : null}

          {item.venue && item.venue !== "—" ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                openStoreSheet({
                  requestId: item.id,
                  storeName: item.venue,
                  address: item.address ?? undefined,
                  fallbackTitle: item.venue,
                });
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition"
              style={{
                background: "transparent",
                color: "var(--spark-text-secondary)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <Store size={13} strokeWidth={1.75} />
              Store profile
            </button>
          ) : null}
        </div>

        {extraContent ? (
          <div
            className="pt-3"
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            {extraContent}
          </div>
        ) : null}

        <div
          className="pt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mono"
          style={{
            borderTop: "1px solid var(--spark-border)",
            color: "var(--spark-text-meta)",
          }}
        >
          <span>j / k step rows</span>
          {item.canApprove && !item.isApprovedOptimistic && onApprove ? (
            <span>· a approve</span>
          ) : null}
          <span>· Enter full page</span>
          <span>· Esc close</span>
        </div>
      </div>
    </SparkSheet>
  );
};

export default RequestQuickPeekSheet;
