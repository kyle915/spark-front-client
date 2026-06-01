/**
 * Local module shims for the US choropleth dependencies.
 *
 * `react-simple-maps` ships no bundled types and its published peer range
 * predates React 19 (we install it with --legacy-peer-deps), so rather than
 * pull the community `@types/react-simple-maps` package — whose own bundled
 * React types can clash with this app's React 19 — we hand-declare just the
 * surface <TenantGeoHeatmap> actually uses. Same convention as the other
 * first-party shims in this folder (react-color, heic2any, libheif-js).
 *
 * `us-atlas/states-10m.json` is a TopoJSON Topology imported statically so Vite
 * bundles it; with `resolveJsonModule` off we type the slice we read here.
 */
declare module "react-simple-maps" {
  import * as React from "react";

  /** A d3-geo projection function (e.g. the one returned by geoAlbersUsa()). */
  export type ProjectionFunction = (
    coordinates: [number, number],
  ) => [number, number] | null;

  export interface ComposableMapProps
    extends React.SVGProps<SVGSVGElement> {
    projection?: string | ProjectionFunction;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    children?: React.ReactNode;
  }
  export const ComposableMap: React.FC<ComposableMapProps>;

  /** One geography as handed to the <Geographies> render-prop. */
  export interface GeographyShape {
    rsmKey: string;
    /** TopoJSON feature id — for us-atlas states this is the 2-digit FIPS. */
    id?: string | number;
    properties: { name?: string } & Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface GeographiesRenderProps {
    geographies: GeographyShape[];
    projection: ProjectionFunction;
    path: (geography: GeographyShape) => string;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (render: GeographiesRenderProps) => React.ReactNode;
    className?: string;
  }
  export const Geographies: React.FC<GeographiesProps>;

  export interface GeographyProps
    extends Omit<React.SVGProps<SVGPathElement>, "style"> {
    geography: GeographyShape;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    onMouseEnter?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseMove?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<SVGPathElement>) => void;
  }
  export const Geography: React.FC<GeographyProps>;
}

declare module "us-atlas/states-10m.json" {
  /** Minimal TopoJSON Topology shape — only what react-simple-maps reads. */
  const topology: {
    type: "Topology";
    objects: Record<string, unknown>;
    [key: string]: unknown;
  };
  export default topology;
}

declare module "d3-geo" {
  /**
   * Minimal slice of d3-geo: just the Albers-USA projection factory and the
   * chainable setters <TenantGeoHeatmap> uses to fit it to the map box. d3-geo
   * is pulled in transitively by react-simple-maps; we type only what we touch.
   */
  export interface GeoProjection {
    (coordinates: [number, number]): [number, number] | null;
    scale(scale: number): this;
    translate(translate: [number, number]): this;
    center(center: [number, number]): this;
  }
  export function geoAlbersUsa(): GeoProjection;
}
