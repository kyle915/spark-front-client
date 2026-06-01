/**
 * Local module shim for the `us-atlas` TopoJSON import.
 *
 * `us-atlas` ships no bundled types, and with `resolveJsonModule` off we can't
 * import the `.json` directly without a declaration. <TenantGeoHeatmap> imports
 * `us-atlas/states-10m.json` statically (so Vite bundles it) and hands it to
 * topojson-client's `feature()` to build the US states choropleth. We declare
 * just the minimal TopoJSON Topology shape we read.
 *
 * `d3-geo` and `topojson-client` themselves are typed by their installed
 * `@types/*` packages (React-version-agnostic — no React peer), so no shim is
 * needed for them. Same convention as the other first-party shims in this
 * folder (react-color, heic2any, libheif-js).
 */
declare module "us-atlas/states-10m.json" {
  /** Minimal TopoJSON Topology shape — only what topojson-client reads. */
  const topology: {
    type: "Topology";
    objects: Record<string, unknown>;
    [key: string]: unknown;
  };
  export default topology;
}
