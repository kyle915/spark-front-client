import type { ReactNode } from "react";
import SparkOverlay from "./SparkOverlay";
import type { JumpOrigin } from "@/motion/opsMotion";
import { confirmActionClass, type ConfirmTone } from "./sparkConfirmTone";

export type { ConfirmTone };

/**
 * Small confirm: title + one sentence + stacked actions.
 * Lime primary / muted cancel. Orange when destructive.
 */
export function SparkConfirm({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  busy,
  tone = "default",
  kicker = "Confirm",
  onConfirm,
  onCancel,
  origin = null,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: ConfirmTone;
  kicker?: string;
  onConfirm: () => void;
  onCancel: () => void;
  origin?: JumpOrigin | null;
}) {
  return (
    <SparkOverlay
      onClose={() => {
        if (!busy) onCancel();
      }}
      origin={origin}
      size="sm"
      label={title}
    >
      <p
        className="spark-overlay-kicker"
        style={{
          color: tone === "danger" ? "var(--spark-orange)" : "var(--spark-lime)",
        }}
      >
        {kicker}
      </p>
      <h2 className="spark-overlay-title">{title}</h2>
      <div className="spark-overlay-copy">{body}</div>
      <div className="spark-overlay-actions">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={confirmActionClass(tone)}
        >
          {busy ? "…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="spark-overlay-action spark-overlay-action-cancel"
        >
          {cancelLabel}
        </button>
      </div>
    </SparkOverlay>
  );
}

export default SparkConfirm;
