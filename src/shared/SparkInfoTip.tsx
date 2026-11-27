import { useId, useState } from "react";
import { Info } from "lucide-react";

/**
 * Subtle ⓘ methodology / scope tooltip so headers stay concise and unadorned
 * while keeping counting rules one hover or tap away.
 */
export function SparkInfoTip({
  note,
  label = "How this is counted",
  className = "",
}: {
  note: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  if (!note.trim()) return null;

  return (
    <span
      className={`relative inline-flex items-center align-middle ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`${label}: ${note}`}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        title={note}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-md transition hover:opacity-100 focus-visible:opacity-100"
        style={{
          color: "var(--spark-text-meta)",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <Info size={13} strokeWidth={1.85} />
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 z-40 w-max max-w-[260px] rounded-[8px] px-2.5 py-1.5 text-xs font-normal leading-snug pointer-events-none"
          style={{
            background: "var(--spark-toast-bg, #14160f)",
            color: "var(--spark-toast-ink, #f2f3ee)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)",
            textTransform: "none",
            letterSpacing: "0",
          }}
        >
          {note}
        </span>
      ) : null}
    </span>
  );
}

export default SparkInfoTip;
