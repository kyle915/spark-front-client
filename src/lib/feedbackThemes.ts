/**
 * Shaping for "What consumers said": themes of consumer comments, split
 * into what people liked, why they passed and what they asked. Pure
 * functions over plain rows, unit-tested without a component or a
 * generated Relay file. Nothing here changes a count.
 */
import { rankRows, type ChartRow } from "@/lib/chartRows";

export type ThemeRow = {
  /** "liked" | "passed" | "asked" */
  section: string;
  label: string;
  /** Approved recaps with a comment in this theme. */
  recapCount: number;
  quote: string;
};

export type ThemeSection = { key: string; title: string; themes: ThemeRow[] };

const SECTIONS: ReadonlyArray<{ key: string; title: string }> = [
  { key: "liked", title: "What people liked" },
  { key: "passed", title: "Why people passed" },
  { key: "asked", title: "Questions people asked" },
];

const usable = (themes: readonly ThemeRow[]): ThemeRow[] =>
  themes.filter((t) => t.label.trim() !== "" && t.recapCount > 0);

/** The three sections in a fixed order, largest theme first, empty ones left out. */
export function themeSections(themes: readonly ThemeRow[]): ThemeSection[] {
  const rows = usable(themes);
  return SECTIONS.map(({ key, title }) => ({
    key,
    title,
    themes: rows
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.section === key)
      .sort((a, b) => b.t.recapCount - a.t.recapCount || a.i - b.i)
      .map(({ t }) => t),
  })).filter((s) => s.themes.length > 0);
}

/** Every theme as one ranked list, for the bar chart. */
export const themeBars = (themes: readonly ThemeRow[]): ChartRow[] =>
  rankRows(usable(themes).map((t) => ({ label: t.label, value: t.recapCount })));

const plural = (n: number, one: string, many: string): string =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export const recapsLabel = (n: number): string => plural(n, "recap", "recaps");

/** The one line that says where the themes came from. */
export function themesBasis(
  commentCount: number,
  recapCount: number,
  truncated = false,
): string {
  const from = `${truncated ? "the most recent " : ""}${plural(commentCount, "comment", "comments")}`;
  return `Grouped by AI from ${from} on ${plural(recapCount, "approved recap", "approved recaps")}. Each count is the recaps that mention a theme.`;
}
