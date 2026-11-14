/**
 * Light / dark appearance for the signed-in app. Light is the default; a
 * person's own choice (account menu → Appearance) is remembered per browser.
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

/** Light unless this browser explicitly chose dark. */
export const DEFAULT_APPEARANCE: Appearance = "light";

export const readAppearance = (): Appearance => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "dark" || saved === "light" ? saved : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
};

export const applyAppearance = (mode: Appearance): void => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") root.setAttribute(APPEARANCE_ATTR, "light");
  else root.removeAttribute(APPEARANCE_ATTR);
};

let shells = 0;

/**
 * The signed-in shell is on screen: apply this browser's appearance until the
 * returned function is called.
 *
 * Counted, because two shells overlap for a moment at sign-in and when
 * switching between the admin and client views. The outgoing shell used to
 * reset the page to dark after the incoming one had already applied light,
 * leaving a dark page with "Light" selected until the setting was toggled.
 */
export const holdAppearance = (): (() => void) => {
  shells += 1;
  applyAppearance(readAppearance());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    shells -= 1;
    if (shells <= 0) {
      shells = 0;
      applyAppearance("dark");
    } else {
      applyAppearance(readAppearance());
    }
  };
};

export const setAppearance = (mode: Appearance): void => {
  try {
    localStorage.setItem(KEY, mode);
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
