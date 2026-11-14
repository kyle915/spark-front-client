import { useEffect, useState } from "react";
import { countUpText } from "./countUp";

const DURATION_MS = 1100;

/** Counts up to `value` once, after `delayMs`. Shows the real figure straight
 *  away for reduced motion, and to screen readers throughout. */
export default function StatFigure({ value, delayMs = 0 }: { value: string; delayMs?: number }) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const still =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    setProgress(0);
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now + delayMs;
      const p = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, delayMs]);

  return (
    <>
      <span aria-hidden="true">{countUpText(value, progress)}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}
