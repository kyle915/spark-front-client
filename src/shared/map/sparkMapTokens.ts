/** Account Map / Leaflet pin colors — visited / scheduled / needs visit. */
export const STATUS_COLOR = {
  recent: "#c5f546",
  scheduled: "#5fb8ef",
  unvisited: "#ef5a2a",
} as const;

export type StatusColorKey = keyof typeof STATUS_COLOR;

/** Carto Dark Matter — copied from leaflet-providers, URL string only. */
export const CARTO_DARK_TILE = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
} as const;

export const OSM_LIGHT_TILE = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
} as const;
