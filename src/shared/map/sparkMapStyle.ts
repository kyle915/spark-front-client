/**
 * One quiet Google map style for every Spark map, in both appearances.
 *
 * The map is a backdrop for pins: no colour of its own, no business or
 * transit labels, roads and water a step away from the land. Towns, road
 * names and parks stay, because people find a store by them.
 *
 * Google reads these as literal colours (a CSS variable is not a colour to
 * it), so each appearance has its own list. A style list only applies to a
 * map created WITHOUT a `mapId` — with one, Google ignores `styles` and the
 * look is set in the Cloud console — so maps using this draw their pins as
 * image markers (see markerIcons.ts), not AdvancedMarkers.
 */
export type MapStyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number>>;
};

export type MapAppearance = "light" | "dark";

type Palette = {
  land: string;
  park: string;
  water: string;
  waterLabel: string;
  road: string;
  roadEdge: string;
  highway: string;
  highwayEdge: string;
  border: string;
  label: string;
  town: string;
  halo: string;
};

const LIGHT: Palette = {
  land: "#f1f1ee",
  park: "#e5e8df",
  water: "#d3dbe0",
  waterLabel: "#7d8990",
  road: "#ffffff",
  roadEdge: "#e3e3de",
  highway: "#e2e2dd",
  highwayEdge: "#d0d1cb",
  border: "#c9cac4",
  label: "#7a7d75",
  town: "#3f423b",
  halo: "#f7f7f4",
};

const DARK: Palette = {
  land: "#17191b",
  park: "#1b1f1c",
  water: "#0e1114",
  waterLabel: "#56606a",
  road: "#24272a",
  roadEdge: "#1c1e21",
  highway: "#2f3337",
  highwayEdge: "#202326",
  border: "#3a3e43",
  label: "#8b9096",
  town: "#c9ccd0",
  halo: "#17191b",
};

function rules(p: Palette): MapStyleRule[] {
  return [
    { elementType: "geometry", stylers: [{ color: p.land }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: p.label }] },
    { elementType: "labels.text.stroke", stylers: [{ color: p.halo }] },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: p.border }],
    },
    {
      featureType: "administrative.land_parcel",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "administrative.neighborhood",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: p.town }],
    },
    // Businesses, attractions, schools, hospitals: all off. Parks keep
    // their shape (no label) as a landmark.
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ visibility: "on" }, { color: p.park }],
    },
    { featureType: "road", elementType: "geometry", stylers: [{ color: p.road }] },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: p.roadEdge }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: p.highway }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: p.highwayEdge }],
    },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: p.water }] },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: p.waterLabel }],
    },
  ];
}

const STYLES: Record<MapAppearance, MapStyleRule[]> = {
  light: rules(LIGHT),
  dark: rules(DARK),
};

export function sparkMapStyle(appearance: MapAppearance): MapStyleRule[] {
  return STYLES[appearance];
}

/** Shown behind the tiles while they load, so the map never flashes white. */
export function sparkMapBackground(appearance: MapAppearance): string {
  return appearance === "light" ? LIGHT.land : DARK.land;
}
