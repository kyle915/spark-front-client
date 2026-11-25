import { useEffect, useRef, type CSSProperties } from "react";
import { scrollToCompletenessTarget } from "./checkinCompleteness";
import { recapCheckKey, type RecapCheckItem } from "./recapCheck";

/**
 * What the recap check found, shown after a tap on Submit.
 *
 * Advice only. "Fix" jumps to the field; "This is correct" marks the note
 * as confirmed (the reviewer later sees "BA confirmed: …"); "Submit as is"
 * files the recap unchanged. Nothing here can stop a recap going in.
 */

const severityTag: Record<RecapCheckItem["severity"], { text: string; style: CSSProperties }> = {
  error: {
    text: "Likely error",
    style: { color: "#8a1c1c", background: "#fdf1f1", border: "1px solid #f1c9c9" },
  },
  warning: {
    text: "Check this",
    style: { color: "#6b4a07", background: "#fbf5e6", border: "1px solid #ecdcb0" },
  },
};

function SeverityTag({ severity }: { severity: RecapCheckItem["severity"] }) {
  const tag = severityTag[severity] ?? severityTag.warning;
  return (
    <span
      style={{
        ...tag.style,
        alignSelf: "flex-start",
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {tag.text}
    </span>
  );
}

const actionBtn: CSSProperties = {
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  color: "#1c1917",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

function ConfirmButton({
  confirmed,
  onToggle,
}: {
  confirmed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={confirmed}
      onClick={onToggle}
      style={{
        ...actionBtn,
        ...(confirmed
          ? { background: "#1c1917", color: "#fff", borderColor: "#1c1917" }
          : {}),
      }}
    >
      {confirmed ? "Marked correct" : "This is correct"}
    </button>
  );
}

function NoteCard({
  item,
  confirmed,
  onToggleConfirm,
  showFix,
}: {
  item: RecapCheckItem;
  confirmed: boolean;
  onToggleConfirm: () => void;
  showFix: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.16)",
        background: confirmed ? "#f5f5f4" : "#faf7f1",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <SeverityTag severity={item.severity} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1c1917" }}>
        {item.message}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {showFix && item.fieldId ? (
          <button
            type="button"
            onClick={() => scrollToCompletenessTarget(item.fieldId as string)}
            style={actionBtn}
          >
            Fix
          </button>
        ) : null}
        <ConfirmButton confirmed={confirmed} onToggle={onToggleConfirm} />
      </div>
    </div>
  );
}

export function RecapCheckNotes({
  items,
  confirmedKeys,
  onToggleConfirm,
  busy,
  onSubmitAsIs,
}: {
  items: RecapCheckItem[];
  confirmedKeys: ReadonlySet<string>;
  onToggleConfirm: (key: string) => void;
  busy: boolean;
  onSubmitAsIs: () => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const shown = items.length > 0;
  useEffect(() => {
    if (shown) box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [shown]);
  if (!shown) return null;
  const allConfirmed = items.every((item) => confirmedKeys.has(recapCheckKey(item)));
  return (
    <div
      ref={box}
      role="status"
      aria-live="polite"
      aria-label="Before this goes in"
      style={{
        border: "1px solid rgba(0,0,0,0.2)",
        borderRadius: 14,
        background: "#fff",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1c1917" }}>
          {items.length === 1 ? "One thing to double-check" : `${items.length} things to double-check`}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#44403c" }}>
          Fix anything that is off. If a number is right, tap “This is correct” so
          your lead knows.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, index) => {
          const key = recapCheckKey(item);
          return (
            <NoteCard
              key={`${key}-${index}`}
              item={item}
              confirmed={confirmedKeys.has(key)}
              onToggleConfirm={() => onToggleConfirm(key)}
              showFix
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={onSubmitAsIs}
        disabled={busy}
        style={{
          minHeight: 48,
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.2)",
          background: allConfirmed ? "#1c1917" : "transparent",
          color: allConfirmed ? "#fff" : "#1c1917",
          fontSize: 14,
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {allConfirmed ? "Submit recap" : "Submit as is"}
      </button>
    </div>
  );
}

/**
 * The same notes, shown right under the field they are about, so the
 * ambassador sees the question where they fix the answer.
 */
export function RecapCheckFieldNotes({
  items,
  confirmedKeys,
  onToggleConfirm,
}: {
  items: RecapCheckItem[];
  confirmedKeys: ReadonlySet<string>;
  onToggleConfirm: (key: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {items.map((item, index) => {
        const key = recapCheckKey(item);
        return (
          <NoteCard
            key={`${key}-${index}`}
            item={item}
            confirmed={confirmedKeys.has(key)}
            onToggleConfirm={() => onToggleConfirm(key)}
            showFix={false}
          />
        );
      })}
    </div>
  );
}
