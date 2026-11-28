import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { CodeShakeBox } from "./CopyMorphButton";
import {
  joinCsvTokens,
  normalizeChipToken,
  splitCsvTokens,
  validateChipToken,
  type ChipInputMode,
} from "./chipInputHelpers";

export interface ChipInputProps {
  value: string;
  onChange: (nextCsv: string) => void;
  mode?: ChipInputMode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Chip Input — Studio multi-token pill input that replaces fragile
 * comma-separated text boxes. Preserves a plain CSV string contract (`value` /
 * `onChange`) including uncommitted draft text so parent Submit buttons enable
 * on first keystroke and never drop an un-entered final token.
 */
export const ChipInput: React.FC<ChipInputProps> = ({
  value,
  onChange,
  mode = "text",
  placeholder,
  required = false,
  disabled = false,
  autoFocus = false,
  ariaLabel,
  className = "",
  style,
}) => {
  const [chips, setChips] = useState<string[]>(() => splitCsvTokens(value, mode));
  const [draft, setDraft] = useState("");
  const [validationErr, setValidationErr] = useState<string | null>(null);
  const [errSeq, setErrSeq] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedRef = useRef<string>(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      setChips(splitCsvTokens(value, mode));
      setDraft("");
      setValidationErr(null);
    }
  }, [value, mode]);

  const emit = (nextChips: string[], nextDraft: string) => {
    const trimmedDraft = nextDraft.trim();
    const combined = joinCsvTokens(
      trimmedDraft ? [...nextChips, trimmedDraft] : nextChips,
    );
    lastEmittedRef.current = combined;
    onChange(combined);
  };

  const commitTokens = (rawChunk: string) => {
    const candidates =
      mode === "email"
        ? rawChunk.split(/[,;\n\s]+/)
        : rawChunk.split(/[,;\n]+/);
    const nextChips = [...chips];
    const seen = new Set(nextChips.map((c) => c.toLowerCase()));
    let rejected = "";
    let firstErr: string | null = null;

    for (const part of candidates) {
      if (!part.trim()) continue;
      const problem = validateChipToken(part, mode);
      if (problem) {
        if (!firstErr) firstErr = problem;
        rejected = rejected ? `${rejected}, ${part.trim()}` : part.trim();
        continue;
      }
      const norm = normalizeChipToken(part, mode);
      const key = norm.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        nextChips.push(norm);
      }
    }

    setChips(nextChips);
    setDraft(rejected);
    if (firstErr) {
      setValidationErr(firstErr);
      setErrSeq((s) => s + 1);
    } else {
      setValidationErr(null);
    }
    emit(nextChips, rejected);
  };

  const removeChip = (idx: number) => {
    const nextChips = chips.filter((_, i) => i !== idx);
    setChips(nextChips);
    emit(nextChips, draft);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-1">
      <CodeShakeBox trigger={errSeq > 0 ? errSeq : null}>
        <div
          onClick={() => {
            if (!disabled) inputRef.current?.focus();
          }}
          className={`flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1.5 min-h-[38px] cursor-text transition ${className}`.trim()}
          style={{
            background: "var(--spark-field-bg, var(--spark-surface))",
            border: validationErr
              ? "1px solid var(--spark-orange, #ef5a2a)"
              : "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            ...style,
          }}
        >
          {chips.map((chip, idx) => (
            <span
              key={`${chip}-${idx}`}
              className="spark-chip-pill inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium max-w-full"
              style={{
                background: "rgba(var(--spark-accent-rgb, 148, 224, 64), 0.14)",
                border:
                  "1px solid rgba(var(--spark-accent-rgb, 148, 224, 64), 0.34)",
                color: "var(--spark-text)",
              }}
            >
              <span className="truncate max-w-[220px]">{chip}</span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip(idx);
                  }}
                  aria-label={`Remove ${chip}`}
                  className="inline-flex items-center justify-center rounded-sm opacity-65 hover:opacity-100 cursor-pointer"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "inherit",
                  }}
                >
                  <X size={11} strokeWidth={2.2} />
                </button>
              ) : null}
            </span>
          ))}

          <input
            ref={inputRef}
            type="text"
            value={draft}
            required={required && chips.length === 0 && draft.trim().length === 0}
            disabled={disabled}
            autoFocus={autoFocus}
            aria-label={ariaLabel}
            placeholder={chips.length === 0 ? placeholder : "Add another…"}
            onChange={(e) => {
              const next = e.target.value;
              if (validationErr) setValidationErr(null);
              if (next.includes(",") || next.includes(";")) {
                commitTokens(next);
                return;
              }
              setDraft(next);
              emit(chips, next);
            }}
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" || e.key === "," || e.key === ";") &&
                draft.trim().length > 0
              ) {
                e.preventDefault();
                commitTokens(draft);
                return;
              }
              if (e.key === "Tab" && draft.trim().length > 0) {
                commitTokens(draft);
                return;
              }
              if (e.key === "Backspace" && draft.length === 0 && chips.length > 0) {
                e.preventDefault();
                removeChip(chips.length - 1);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text && /[,;\n]/.test(text)) {
                e.preventDefault();
                commitTokens(draft ? `${draft}, ${text}` : text);
              }
            }}
            onBlur={() => {
              if (draft.trim().length > 0) {
                commitTokens(draft);
              }
            }}
            className="flex-1 min-w-[130px] bg-transparent text-xs outline-none"
            style={{ color: "var(--spark-text)" }}
          />
        </div>
      </CodeShakeBox>
      {validationErr ? (
        <p
          role="status"
          className="text-[11px] font-medium"
          style={{ color: "var(--spark-flag-ink, var(--spark-orange, #ef5a2a))" }}
        >
          {validationErr}
        </p>
      ) : null}
    </div>
  );
};

export default ChipInput;
