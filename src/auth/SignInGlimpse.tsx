import { useEffect, useState } from "react";
import { GLIMPSE_ROWS, glimpseLabel, glimpseStages } from "./glimpseStages";

const TICK_MS = 2200;

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Decorative: hidden from screen readers, still for reduced motion. */
export default function SignInGlimpse() {
  // With reduced motion the board shows one telling moment and stays put.
  const [tick, setTick] = useState(() => (reducedMotion() ? 4 : 0));

  useEffect(() => {
    if (reducedMotion()) return;
    const id = window.setInterval(() => {
      // Do not spend battery animating a tab nobody is looking at.
      if (!document.hidden) setTick((t) => t + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const stages = glimpseStages(tick);

  return (
    <div className="signin-glimpse" aria-hidden="true">
      <div className="signin-glimpse-head">
        <span>Today</span>
        <span>Example</span>
      </div>
      {GLIMPSE_ROWS.map((row, i) => (
        <div className="signin-glimpse-row" key={row.store}>
          <div className="signin-glimpse-where">
            <span className="signin-glimpse-store">{row.store}</span>
            <span className="signin-glimpse-place">{row.place}</span>
          </div>
          {/* Keyed by stage so each change fades in instead of snapping. */}
          <span key={stages[i]} className={`signin-glimpse-state is-${stages[i]}`}>
            <i />
            {glimpseLabel(stages[i], row)}
          </span>
        </div>
      ))}
    </div>
  );
}
