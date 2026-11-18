import type { GalleryPhoto } from "./photoGallery";

/** What the photo library search is narrowed by. Mirrors the server's
 *  PhotoLibraryFilterInput; every value is checked again on the server. */
export type LibraryFilters = {
  text: string;
  shows: string[];
  crowdSizes: string[];
  settings: string[];
  productIds: string[];
  store: string;
  states: string[];
  startDate: string | null;
  endDate: string | null;
  minQuality: number | null;
  peoplePresent: boolean | null;
  hideIssues: boolean;
  sort: string;
};

export const EMPTY_LIBRARY_FILTERS: LibraryFilters = {
  text: "",
  shows: [],
  crowdSizes: [],
  settings: [],
  productIds: [],
  store: "",
  states: [],
  startDate: null,
  endDate: null,
  minQuality: null,
  peoplePresent: null,
  hideIssues: false,
  sort: "",
};

/** Tag types offered as one-tap chips under the search box. */
export const QUICK_SHOWS = [
  "consumers_engaging",
  "product_on_table",
  "shelf_display",
  "signage",
] as const;

export const SORT_LABELS: Record<string, string> = {
  relevance: "Best match",
  quality: "Best quality",
  newest: "Newest",
};

/** True when any library filter is set, so the page shows search results
 *  instead of the plain gallery. */
export const isSearching = (f: LibraryFilters): boolean =>
  Boolean(
    f.text ||
    f.shows.length ||
    f.crowdSizes.length ||
    f.settings.length ||
    f.productIds.length ||
    f.store ||
    f.states.length ||
    f.startDate ||
    f.endDate ||
    f.minQuality !== null ||
    f.peoplePresent !== null ||
    f.hideIssues ||
    f.sort,
  );

export const toggleKey = (list: readonly string[], key: string): string[] =>
  list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

type Interpreted = {
  readonly text: string;
  readonly shows: readonly string[];
  readonly crowdSizes: readonly string[];
  readonly settings: readonly string[];
  readonly productIds: readonly string[];
  readonly store: string;
  readonly states: readonly string[];
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly minQuality?: number | null;
  readonly peoplePresent?: boolean | null;
  readonly hideIssues: boolean;
  readonly sort: string;
};

/** The server's reading of a typed search → filters the page holds. */
export const fromInterpretation = (f: Interpreted): LibraryFilters => ({
  text: f.text,
  shows: [...f.shows],
  crowdSizes: [...f.crowdSizes],
  settings: [...f.settings],
  productIds: [...f.productIds],
  store: f.store,
  states: [...f.states],
  startDate: f.startDate ?? null,
  endDate: f.endDate ?? null,
  minQuality: f.minQuality ?? null,
  peoplePresent: f.peoplePresent ?? null,
  hideIssues: f.hideIssues,
  sort: f.sort,
});

export type FilterChip = { id: string; label: string; without: LibraryFilters };

type Labels = {
  shows: ReadonlyMap<string, string>;
  crowd: ReadonlyMap<string, string>;
  settings: ReadonlyMap<string, string>;
  products: ReadonlyMap<string, string>;
};

const fmtDay = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

/** One removable chip per filter in use, in plain words. */
export const filterChips = (f: LibraryFilters, labels: Labels): FilterChip[] => {
  const chips: FilterChip[] = [];
  const list = (
    key: "shows" | "crowdSizes" | "settings" | "productIds" | "states",
    names: ReadonlyMap<string, string> | null,
  ) => {
    for (const value of f[key]) {
      chips.push({
        id: `${key}:${value}`,
        label: names?.get(value) ?? value,
        without: { ...f, [key]: f[key].filter((v) => v !== value) },
      });
    }
  };
  if (f.text)
    chips.push({
      id: "text",
      label: `“${f.text}”`,
      without: { ...f, text: "" },
    });
  list("shows", labels.shows);
  list("crowdSizes", labels.crowd);
  list("settings", labels.settings);
  list("productIds", labels.products);
  if (f.store) chips.push({ id: "store", label: f.store, without: { ...f, store: "" } });
  list("states", null);
  if (f.startDate || f.endDate) {
    const label = [f.startDate, f.endDate]
      .map((d) => (d ? fmtDay(d) : ""))
      .join(" to ")
      .trim();
    chips.push({
      id: "dates",
      label:
        f.startDate && f.endDate
          ? label
          : f.startDate
            ? `From ${fmtDay(f.startDate)}`
            : `Until ${fmtDay(f.endDate ?? "")}`,
      without: { ...f, startDate: null, endDate: null },
    });
  }
  if (f.minQuality !== null)
    chips.push({
      id: "quality",
      label: `Quality ${f.minQuality}+`,
      without: { ...f, minQuality: null },
    });
  if (f.hideIssues)
    chips.push({
      id: "issues",
      label: "No blurry or dark photos",
      without: { ...f, hideIssues: false },
    });
  if (f.peoplePresent !== null)
    chips.push({
      id: "people",
      label: f.peoplePresent ? "People in frame" : "No people in frame",
      without: { ...f, peoplePresent: null },
    });
  if (f.sort)
    chips.push({
      id: "sort",
      label: SORT_LABELS[f.sort] ?? f.sort,
      without: { ...f, sort: "" },
    });
  return chips;
};

/** Variables for PhotoLibraryQuery. Blank values are left out. */
export const toFilterInput = (
  f: LibraryFilters,
  opts: {
    approvedOnly: boolean;
    picksOnly: boolean;
    startDate: string | null;
    endDate: string | null;
  },
) => ({
  text: f.text || null,
  shows: f.shows.length ? f.shows : null,
  crowdSizes: f.crowdSizes.length ? f.crowdSizes : null,
  settings: f.settings.length ? f.settings : null,
  productIds: f.productIds.length ? f.productIds : null,
  store: f.store || null,
  states: f.states.length ? f.states : null,
  // A date the search named wins over the page's date range.
  startDate: f.startDate ?? opts.startDate,
  endDate: f.startDate || f.endDate ? f.endDate : opts.endDate,
  minQuality: f.minQuality,
  peoplePresent: f.peoplePresent,
  hideIssues: f.hideIssues,
  approvedOnly: opts.approvedOnly,
  picksOnly: opts.picksOnly,
  sort: f.sort || null,
});

type LibraryPhotoLike = {
  readonly id: string;
  readonly url: string;
  readonly caption: string;
  readonly category: string;
  readonly showLabels: readonly string[];
  readonly store: string;
  readonly state: string;
  readonly eventDate: string;
  readonly recapUuid: string;
  readonly isPick: boolean;
};

/** A library photo in the gallery's shape, so selecting, the zip and the
 *  photo deck work the same on both views. Never the file name. */
export const toGalleryPhoto = (p: LibraryPhotoLike): GalleryPhoto => ({
  id: p.id,
  url: p.url,
  category: p.showLabels[0] || p.category,
  recapUuid: p.recapUuid,
  store: p.store,
  state: p.state,
  eventDate: p.eventDate,
  isPick: p.isPick,
  caption: p.caption,
});

/** Spark's 0–100 score in a word. */
export const qualityWord = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return "";
  if (score >= 75) return "Strong photo";
  if (score >= 55) return "Good photo";
  return "Weak photo";
};

/** Ids to save on a recap deck draft: what it has, then the new ones, no
 *  repeats, capped at the server's limit (13). */
export const MAX_DECK_PHOTOS = 13;
export const mergeDeckPhotoIds = (
  current: readonly string[],
  adding: readonly string[],
): { ids: string[]; added: number; dropped: number } => {
  const ids = [...current];
  let added = 0;
  let dropped = 0;
  for (const id of adding) {
    if (ids.includes(id)) continue;
    if (ids.length >= MAX_DECK_PHOTOS) {
      dropped += 1;
      continue;
    }
    ids.push(id);
    added += 1;
  }
  return { ids, added, dropped };
};

/** Labels for the tag keys, before the first page has loaded. The server
 *  sends the same list with every page. */
const SHOW_LABELS = new Map<string, string>([
  ["consumers_engaging", "Consumers engaging"],
  ["product_on_table", "Product on table"],
  ["shelf_display", "Shelf display"],
  ["ba_at_table", "Ambassador at table"],
  ["signage", "Signage"],
  ["store_exterior", "Store front"],
  ["other", "Other"],
]);

export type LibraryOptions = {
  shows: ReadonlyMap<string, string>;
  crowd: ReadonlyMap<string, string>;
  settings: ReadonlyMap<string, string>;
  products: ReadonlyMap<string, string>;
};

export const EMPTY_OPTIONS: LibraryOptions = {
  shows: SHOW_LABELS,
  crowd: new Map(),
  settings: new Map(),
  products: new Map(),
};

type OptionList = readonly { readonly key: string; readonly label: string }[];

/** The option lists a page of results carries → label lookups. */
export const optionsFromPage = (page: {
  readonly showOptions: OptionList;
  readonly crowdOptions: OptionList;
  readonly settingOptions: OptionList;
  readonly products: OptionList;
}): LibraryOptions => ({
  shows: new Map(page.showOptions.map((o) => [o.key, o.label])),
  crowd: new Map(page.crowdOptions.map((o) => [o.key, o.label])),
  settings: new Map(page.settingOptions.map((o) => [o.key, o.label])),
  products: new Map(page.products.map((o) => [o.key, o.label])),
});
