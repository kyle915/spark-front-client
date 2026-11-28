import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  SWIPE_COMMIT_THRESHOLD,
  swipeProgressFromDelta,
} from "./confirmGestureMath";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hold to Confirm — press-and-hold destructive confirmation button with
 * real-time left-to-right progress fill. Prevents accidental single-click
 * deletions/cancellations while keeping keyboard Enter/Space accessible
 * (and instant-click under `prefers-reduced-motion: reduce`).
 */
export interface HoldToConfirmButtonProps {
  label: string;
  holdingLabel?: string;
  busyLabel?: string;
  holdMs?: number;
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  label,
  holdingLabel = "Keep holding…",
  busyLabel = "Working…",
  holdMs = 700,
  busy = false,
  disabled = false,
  onConfirm,
  className = "",
  style,
}) => {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const firedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHolding(false);
    setProgress(0);
  }, []);

  useEffect(() => cancelHold, [cancelHold]);

  const startHold = useCallback(() => {
    if (disabled || busy) return;
    if (prefersReducedMotion()) {
      onConfirm();
      return;
    }
    firedRef.current = false;
    setHolding(true);
    startRef.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - startRef.current;
      const p = Math.min(1, elapsed / holdMs);
      setProgress(p);
      if (p >= 1) {
        rafRef.current = null;
        setHolding(false);
        setProgress(0);
        if (!firedRef.current) {
          firedRef.current = true;
          onConfirm();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [disabled, busy, holdMs, onConfirm]);

  const idlePrompt = /^hold\b/i.test(label)
    ? label
    : `Hold to ${label.toLowerCase()}`;

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        startHold();
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onKeyDown={(e) => {
        if (e.repeat) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          startHold();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          cancelHold();
        }
      }}
      aria-label={idlePrompt}
      className={`spark-hold-btn ${className}`.trim()}
      style={style}
    >
      <span
        className="spark-hold-fill"
        aria-hidden
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
        {busy ? busyLabel : holding ? holdingLabel : idlePrompt}
      </span>
    </button>
  );
};

/**
 * Swipe to Confirm — tactile mobile slide-to-confirm track for BA Clock In /
 * Clock Out. Prevents accidental aisle pocket-taps while keeping keyboard
 * Enter/Space activation fully accessible.
 */
export interface SwipeToConfirmProps {
  label: string;
  busyLabel?: string;
  doneLabel?: string;
  accent?: string;
  textColor?: string;
  busy?: boolean;
  done?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  style?: React.CSSProperties;
}

export const SwipeToConfirm: React.FC<SwipeToConfirmProps> = ({
  label,
  busyLabel = "Working…",
  doneLabel = "Confirmed",
  accent = "var(--spark-lime)",
  textColor = "var(--spark-on-accent, #0a0d09)",
  busy = false,
  done = false,
  disabled = false,
  onConfirm,
  style,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const startXRef = useRef(0);
  const maxTravelRef = useRef(1);
  const thumbWidth = 48;

  const locked = disabled || busy || done;

  const beginDrag = (clientX: number, pointerId: number, el: HTMLElement) => {
    if (locked) return;
    const track = trackRef.current;
    if (!track) return;
    maxTravelRef.current = Math.max(1, track.clientWidth - thumbWidth - 8);
    startXRef.current = clientX;
    setDragging(true);
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // ignore pointer capture failure in synthetic events
    }
  };

  const moveDrag = (clientX: number) => {
    if (!dragging || locked) return;
    const p = swipeProgressFromDelta(clientX - startXRef.current, maxTravelRef.current);
    setProgress(p);
  };

  const endDrag = () => {
    if (!dragging) return;
    const committed = progress >= SWIPE_COMMIT_THRESHOLD;
    setDragging(false);
    setProgress(0);
    if (committed && !locked) {
      onConfirm();
    }
  };

  const rightEdge = trackRef.current
    ? Math.max(0, trackRef.current.clientWidth - thumbWidth - 8)
    : maxTravelRef.current;
  const travelPx = dragging ? progress * maxTravelRef.current : done ? rightEdge : 0;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked}
      aria-label={label}
      onKeyDown={(e) => {
        if (!locked && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onConfirm();
        }
      }}
      className="spark-swipe-track"
      style={{
        minHeight: 54,
        width: "100%",
        borderRadius: 14,
        background: accent,
        color: textColor,
        opacity: disabled && !busy && !done ? 0.5 : 1,
        fontWeight: 700,
        fontSize: 15,
        position: "relative",
        ...style,
      }}
    >
      <span
        className="spark-swipe-fill"
        aria-hidden
        style={{
          background: "rgba(0,0,0,0.14)",
          transform: `scaleX(${done ? 1 : progress})`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      <span
        className="relative z-10 pointer-events-none"
        style={{
          paddingLeft: thumbWidth / 2,
          opacity: dragging ? Math.max(0.25, 1 - progress * 0.9) : 1,
          transition: dragging ? "none" : "opacity 180ms ease",
        }}
      >
        {busy ? busyLabel : done ? doneLabel : `Slide to ${label.toLowerCase()}`}
      </span>
      <span
        className="spark-swipe-thumb"
        aria-hidden
        onPointerDown={(e) => beginDrag(e.clientX, e.pointerId, e.currentTarget)}
        onPointerMove={(e) => moveDrag(e.clientX)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          width: thumbWidth,
          transform: `translateX(${travelPx}px)`,
          transition: dragging
            ? "none"
            : "transform 260ms cubic-bezier(0.34, 1.35, 0.64, 1)",
        }}
      >
        {done ? (
          <svg width="18" height="18" viewBox="0 0 16 16" className="spark-ops-check">
            <path className="spark-ops-check-path" d="M3.2 8.2 6.4 11.4 12.8 4.6" />
          </svg>
        ) : busy ? (
          <span className="spark-ops-spinner" style={{ width: 16, height: 16 }} />
        ) : (
          <ChevronRight size={20} strokeWidth={2.4} />
        )}
      </span>
    </div>
  );
};
