import React, { useEffect, useRef, useState } from "react";
import SparkOverlay from "./SparkOverlay";

export interface SparkPromptOverlayProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  kicker?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Studio modal replacement for native browser text prompts.
 * Auto-focuses and selects default text, submits on Enter, dismisses on Esc.
 */
export const SparkPromptOverlay: React.FC<SparkPromptOverlayProps> = ({
  open,
  title,
  description,
  kicker = "Name",
  placeholder = "",
  defaultValue = "",
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      if (defaultValue) inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(id);
  }, [open, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onConfirm(trimmed);
  };

  return (
    <SparkOverlay
      open={open}
      onClose={() => {
        if (!busy) onCancel();
      }}
      size="sm"
      label={title}
    >
      <form onSubmit={handleSubmit}>
        <p
          className="spark-overlay-kicker"
          style={{ color: "var(--spark-lime)" }}
        >
          {kicker}
        </p>
        <h2 className="spark-overlay-title">{title}</h2>
        {description ? (
          <div className="spark-overlay-copy">{description}</div>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          aria-label={title}
          className="w-full mt-3 rounded-xl px-3.5 py-2.5 text-sm outline-none"
          style={{
            background: "var(--spark-field-bg, var(--spark-surface-2))",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        />
        <div className="spark-overlay-actions">
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="spark-overlay-action spark-overlay-action-primary"
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="spark-overlay-action spark-overlay-action-cancel"
          >
            {cancelLabel}
          </button>
        </div>
      </form>
    </SparkOverlay>
  );
};

export default SparkPromptOverlay;
