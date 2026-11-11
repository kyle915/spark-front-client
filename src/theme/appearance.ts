/**
 * Light / dark appearance for the signed-in app.
 *
 * Light is a MODIFIER on top of the spark-v2 theme (`data-spark-mode="light"`
 * on <html>) rather than a second daisyUI theme, so nothing else that sets
 * `data-theme` has to know about it. The attribute is only present while the
 * authenticated shell is mounted — public pages and the ambassador check-in
 * keep their own dark styling.
 */
export type Appearance = "dark" | "light";

const KEY = "@spark.appearance";
export const APPEARANCE_ATTR = "data-spark-mode";
const EVENT = "spark:appearance";

export const readAppearance = (): Appearance => {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

export const applyAppearance = (mode: Appearance): void => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") root.setAttribute(APPEARANCE_ATTR, "light");
  else root.removeAttribute(APPEARANCE_ATTR);
};

export const setAppearance = (mode: Appearance): void => {
  try {
    if (mode === "light") localStorage.setItem(KEY, "light");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: applies for this visit only */
  }
  applyAppearance(mode);
  window.dispatchEvent(new Event(EVENT));
};

export const onAppearanceChange = (fn: () => void): (() => void) => {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
};

export const isLightMode = (): boolean =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute(APPEARANCE_ATTR) === "light";
