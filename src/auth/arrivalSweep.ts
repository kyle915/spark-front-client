/**
 * One sweep as sign-in gives way to the app: a dark band crosses the screen
 * and the dashboard is behind it. Played once per sign-in, never on ordinary
 * navigation.
 *
 * It must never stand between someone and the app. `go` runs exactly once:
 * at the band's midpoint when everything works, and straight away when the
 * person prefers reduced motion, the browser has no WebGL, the library fails
 * to load, or the band is late.
 */

/** Spark's ink, through a deep olive. No rainbow. Cosine palette:
 *  colour(t) = a + b * cos(2π(c·t + d)). */
export const ARRIVAL_PALETTE = {
  a: [0.15, 0.17, 0.1] as [number, number, number],
  b: [0.12, 0.14, 0.06] as [number, number, number],
  c: [1, 1, 1] as [number, number, number],
  d: [0, 0.02, 0.05] as [number, number, number],
};

/** If the band has not reached its midpoint by now, go anyway. */
export const ARRIVAL_DEADLINE_MS = 1400;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Wrap `go` so it can only run once, however many paths reach it. */
export const once = (go: () => void): (() => void) => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    go();
  };
};

export async function playArrival(go: () => void): Promise<void> {
  const arrive = once(go);
  if (typeof document === "undefined" || prefersReducedMotion()) {
    arrive();
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;pointer-events:none";
  const cleanUp = () => canvas.remove();
  const deadline = window.setTimeout(arrive, ARRIVAL_DEADLINE_MS);

  try {
    // Loaded only at sign-in, so it costs nothing on any other page.
    const { createShader, playSweep } = await import("glimm");
    document.body.appendChild(canvas);
    const shader = createShader({ canvas, palette: ARRIVAL_PALETTE, bandTight: 10 });
    if (!shader) throw new Error("no WebGL");
    playSweep(shader, {
      palette: ARRIVAL_PALETTE,
      sweepMs: 900,
      outroMs: 200,
      midpoint: 0.5,
      easing: "easeInOutCubic",
      bandTight: 10,
      rippleAmount: 0.35,
      swellAmount: 0.15,
      onMidpoint: arrive,
      onComplete: () => {
        window.clearTimeout(deadline);
        shader.destroy();
        cleanUp();
      },
    });
  } catch {
    window.clearTimeout(deadline);
    cleanUp();
    arrive();
  }
}
