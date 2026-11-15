import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  DISMISS_NOTE_MAX,
  DISMISS_REASONS,
  cleanDismissNote,
  dismissNoteProblem,
  type DismissReason,
} from "./missingRecapDismiss";

/**
 * "Dismiss" on a Missing Recaps row: a quiet outlined button that opens a
 * small menu of reasons. Picking a reason dismisses straight away. A note
 * is optional and typed in the same menu; "Other" needs one. No modal.
 */
export default function DismissRecapMenu({
  label = "Dismiss",
  busyLabel = "Dismissing…",
  title,
  busy = false,
  disabled = false,
  onDismiss,
}: {
  label?: string;
  busyLabel?: string;
  title?: string;
  busy?: boolean;
  disabled?: boolean;
  onDismiss: (reason: DismissReason, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  // "Other" was picked before a note was typed: Enter in the note sends it.
  const [awaitingOther, setAwaitingOther] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Horizontal offset of the menu from the button's left edge. It opens
  // right-aligned to the button, then is pulled back inside the window —
  // on a phone the buttons wrap to the left of the card.
  const [menuLeft, setMenuLeft] = useState<number | null>(null);
  const menuId = useId();
  const noteId = useId();

  const close = (refocus = false) => {
    setOpen(false);
    setNote("");
    setProblem(null);
    setAwaitingOther(false);
    if (refocus) buttonRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuLeft(null);
      return;
    }
    const root = rootRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!root || !menu) return;
    const gutter = 16;
    const wanted = root.right - menu.width;
    const max = window.innerWidth - menu.width - gutter;
    const clamped = Math.max(gutter, Math.min(wanted, max));
    setMenuLeft(clamped - root.left);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (reason: DismissReason) => {
    const why = dismissNoteProblem(reason, note);
    if (why) {
      setProblem(why);
      setAwaitingOther(reason === "other");
      noteRef.current?.focus();
      return;
    }
    const clean = cleanDismissNote(note);
    close(true);
    onDismiss(reason, clean);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
        style={{
          background: "transparent",
          color: "var(--spark-text)",
          border: "1px solid var(--spark-border)",
        }}
        title={title ?? "No recap is owed for this row. Choose a reason."}
      >
        {busy ? busyLabel : label}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Reason for dismissing"
          className="spark-popover absolute top-full mt-1 z-50 p-1 rounded-xl"
          style={{
            left: menuLeft ?? 0,
            visibility: menuLeft === null ? "hidden" : "visible",
            width: "min(17.5rem, calc(100vw - 2rem))",
            background: "var(--spark-surface)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          <p
            className="px-3 pt-2 pb-1 text-xs"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Why is no recap owed?
          </p>
          {DISMISS_REASONS.map((r, i) => (
            <button
              key={r.value}
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              onClick={() => choose(r.value)}
              className="spark-dismiss-reason block w-full text-left px-3 py-2 rounded-lg text-sm"
            >
              {r.label}
            </button>
          ))}
          <div
            className="mt-1 px-3 pt-2 pb-2"
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            <label
              htmlFor={noteId}
              className="block text-xs mb-1"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Note (optional, needed for Other)
            </label>
            <input
              ref={noteRef}
              id={noteId}
              type="text"
              value={note}
              maxLength={DISMISS_NOTE_MAX}
              onChange={(e) => {
                setNote(e.target.value);
                if (problem) setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (awaitingOther) choose("other");
              }}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${noteId}-problem` : undefined}
              className="w-full rounded-lg text-sm"
              style={{
                padding: "0.4rem 0.6rem",
                background: "var(--spark-bg)",
                border: `1px solid ${problem ? "var(--spark-orange)" : "var(--spark-border)"}`,
                color: "var(--spark-text)",
              }}
            />
            {problem && (
              <p
                id={`${noteId}-problem`}
                role="alert"
                className="text-xs mt-1"
                style={{ color: "var(--spark-orange)" }}
              >
                {problem}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
