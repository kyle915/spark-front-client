import React, { memo, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minimize2, X } from "lucide-react";

/**
 * Crisp 4-point Spark emblem — custom geometric SVG primitive (no emojis,
 * matches Spark's warm-stone & ink Studio aesthetic).
 */
export const SparkEmblem: React.FC<{ size?: number; className?: string }> = memo(
  function SparkEmblem({ size = 15, className }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
      >
        <path d="M12 1.75c.45 4.85 3.4 7.8 8.25 8.25-4.85.45-7.8 3.4-8.25 8.25-.45-4.85-3.4-7.8-8.25-8.25 4.85-.45 7.8-3.4 8.25-8.25Z" />
        <path
          d="M19.25 15.25c.22 1.68 1.22 2.68 2.9 2.9-1.68.22-2.68 1.22-2.9 2.9-.22-1.68-1.22-2.68-2.9-2.9 1.68-.22 2.68-1.22 2.9-2.9Z"
          opacity={0.78}
        />
      </svg>
    );
  },
);

/**
 * Isolated subtle live status pulse dot so perpetual motion never triggers
 * re-renders in the parent popover tree.
 */
export const LivePulseDot: React.FC<{ className?: string }> = memo(function LivePulseDot({
  className = "",
}) {
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`} aria-hidden="true">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-65 animate-ping"
        style={{ background: "#22c55e", animationDuration: "2.6s" }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ background: "#16a34a" }}
      />
    </span>
  );
});

/**
 * Animated three-dot thinking indicator (replaces generic spinners).
 */
export const SparkThinkingDots: React.FC<{ label: string }> = memo(
  function SparkThinkingDots({ label }) {
    return (
      <div
        className="inline-flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-medium"
        style={{
          background: "var(--spark-surface-2)",
          color: "var(--spark-text-secondary)",
          border: "1px solid var(--spark-border)",
        }}
        role="status"
        aria-live="polite"
      >
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((idx) => (
            <motion.span
              key={idx}
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--spark-text-meta)" }}
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2.5, 0] }}
              transition={{
                duration: 1.05,
                repeat: Infinity,
                delay: idx * 0.16,
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
        <span>{label}</span>
      </div>
    );
  },
);

interface AskSparkPopoverFrameProps {
  title?: string;
  contextLabel?: string;
  roleBadge?: string | null;
  subtitle?: string;
  headerExtra?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Floating bottom-right studio pop-up shell for Ask Spark (Client & Admin).
 * Non-blocking: users can keep reading dashboards, reports, or maps while
 * chatting, and expand/compact the pop-up on demand.
 */
export default function AskSparkPopoverFrame({
  title = "Ask Spark",
  contextLabel,
  roleBadge,
  subtitle,
  headerExtra,
  onClose,
  children,
}: AskSparkPopoverFrameProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const widthClass = expanded
    ? "md:w-[560px] md:h-[min(760px,calc(100dvh-4.25rem))]"
    : "md:w-[424px] md:h-[min(600px,calc(100dvh-5.5rem))]";

  return (
    <motion.section
      role="dialog"
      aria-label={title}
      aria-modal="false"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      style={{
        transformOrigin: "bottom right",
        background: "var(--spark-surface)",
        color: "var(--spark-text)",
        border: "1px solid var(--spark-border)",
        boxShadow:
          "0 26px 68px -18px rgba(15,18,12,0.28), 0 6px 20px -6px rgba(15,18,12,0.12), inset 0 1px 0 rgba(255,255,255,0.14)",
      }}
      className={`fixed z-40 print:hidden left-3 right-3 bottom-[70px] h-[min(74dvh,580px)] md:left-auto md:right-5 md:bottom-5 ${widthClass} max-w-[calc(100vw-1.5rem)] md:max-w-[calc(100vw-2.5rem)] rounded-2xl overflow-hidden flex flex-col`}
    >
      {/* Header strip */}
      <header
        className="shrink-0 px-4 pt-3.5 pb-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(var(--spark-ink-rgb),0.035) 0%, transparent 100%)",
          borderBottom: "1px solid var(--spark-hairline, var(--spark-border))",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <SparkEmblem size={15} />
              <span
                className="absolute -bottom-0.5 -right-0.5 rounded-full p-[1.5px]"
                style={{ background: "var(--spark-surface)" }}
              >
                <LivePulseDot />
              </span>
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2
                  className="text-[14.5px] font-semibold tracking-tight truncate"
                  style={{ color: "var(--spark-text)" }}
                >
                  {title}
                </h2>
                {contextLabel ? (
                  <span
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium truncate max-w-[130px]"
                    style={{
                      background: "var(--spark-surface-2)",
                      color: "var(--spark-text-secondary)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    {contextLabel}
                  </span>
                ) : null}
                {roleBadge ? (
                  <span
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0"
                    style={{
                      background: "rgba(var(--spark-ink-rgb),0.08)",
                      color: "var(--spark-text)",
                    }}
                  >
                    {roleBadge}
                  </span>
                ) : null}
              </div>
              {subtitle ? (
                <p
                  className="text-[11.5px] leading-snug truncate mt-0.5"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="hidden md:inline-flex h-7 w-7 items-center justify-center rounded-lg transition hover:opacity-80 active:scale-95 cursor-pointer"
              style={{
                background: "transparent",
                color: "var(--spark-text-meta)",
                border: "1px solid transparent",
              }}
              title={expanded ? "Compact size" : "Expand pop-up"}
              aria-label={expanded ? "Compact Ask Spark pop-up" : "Expand Ask Spark pop-up"}
            >
              {expanded ? (
                <Minimize2 size={14} strokeWidth={1.85} />
              ) : (
                <Maximize2 size={14} strokeWidth={1.85} />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition hover:opacity-80 active:scale-95 cursor-pointer"
              style={{
                background: "rgba(var(--spark-ink-rgb),0.05)",
                color: "var(--spark-text-secondary)",
                border: "none",
              }}
              title="Minimize Ask Spark (Esc)"
              aria-label="Close Ask Spark"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {headerExtra ? <div className="mt-2.5">{headerExtra}</div> : null}
      </header>

      {/* Body + Sticky Composer supplied by children */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
    </motion.section>
  );
}
