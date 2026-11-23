/**
 * The short strip at the top of the program report. It only reorders
 * themes the report already computed. It does not score photos or call a model.
 */
import { themeSections, type ThemeRow } from "./feedbackThemes";

/** The largest theme in each section, liked then passed then asked. */
export function leadThemes(themes: readonly ThemeRow[]): ThemeRow[] {
  return themeSections(themes)
    .map((section) => section.themes[0])
    .filter((theme): theme is ThemeRow => Boolean(theme));
}
