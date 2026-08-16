import * as L from "leaflet";
import { STATUS_COLOR } from "./sparkMapTokens";

export { CARTO_DARK_TILE, OSM_LIGHT_TILE, STATUS_COLOR } from "./sparkMapTokens";
export type { StatusColorKey } from "./sparkMapTokens";

export function sparkDotIcon(color: string = STATUS_COLOR.recent): L.DivIcon {
  return L.divIcon({
    className: "spark-map-dot",
    html: `<span class="spark-map-dot-core" style="background:${color};box-shadow:0 0 10px ${color}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });
}

export function sparkClusterIcon(count: number): L.DivIcon {
  const size = count > 99 ? 40 : count > 9 ? 36 : 32;
  return L.divIcon({
    className: "spark-map-cluster",
    html: `<span class="spark-map-cluster-core">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function clusterIconCreateFunction(cluster: {
  getChildCount: () => number;
}): L.DivIcon {
  return sparkClusterIcon(cluster.getChildCount());
}
