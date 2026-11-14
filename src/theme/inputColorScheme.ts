import { isLightMode } from "./appearance";

/**
 * `color-scheme` for native date / time inputs inside the signed-in shell.
 *
 * These inputs used to hard-code "dark", which draws the browser's calendar
 * and clock icons in white. In light mode that is white on a near-white
 * field: the picker button is there but cannot be seen. Call this while
 * rendering (not at module load) so it reads the appearance in force.
 *
 * Public pages, auth pages and the ambassador check-in stay dark on purpose
 * and do not use this.
 */
export const inputColorScheme = (): "light" | "dark" =>
  isLightMode() ? "light" : "dark";
