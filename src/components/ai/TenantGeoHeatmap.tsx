import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { TenantMarketPerformanceQuery } from "@/api/queries/TenantMarketPerformanceQuery";
import type { TenantMarketPerformanceQuery as TenantMarketPerformanceQueryType } from "@api/queries/__generated__/TenantMarketPerformanceQuery.graphql";
import GeoHeatmapView from "@/components/ai/GeoHeatmapView";

/**
 * Geographic performance for one client (tenant): loads
 * `tenantMarketPerformance` for the page's date range (all-time when none)
 * and hands the per-state rows to <GeoHeatmapView>, which draws the map,
 * the ranked list and the tooltip. Clicking a state opens the tracker
 * filtered to it.
 *
 * Mounted on the dashboard, Reports and the client detail page inside a
 * <Suspense>, scoped to the active tenant.
 */
const TenantGeoHeatmap: React.FC<{
  tenantId: string;
  startDate?: string | null;
  endDate?: string | null;
  rangeLabel?: string;
  onStateSelect?: (stateCode: string) => void;
}> = ({ tenantId, startDate = null, endDate = null, rangeLabel, onStateSelect }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<TenantMarketPerformanceQueryType>(
    TenantMarketPerformanceQuery,
    { tenantId, startDate: startDate || null, endDate: endDate || null },
    { fetchPolicy: "store-or-network" },
  );

  return (
    <GeoHeatmapView
      rows={data?.tenantMarketPerformance ?? []}
      rangeLabel={rangeLabel}
      onSelectState={(code) => {
        onStateSelect?.(code);
        // Tracker market filter takes a 2-letter state code.
        navigate(`/requests/list?market=${encodeURIComponent(code)}`);
      }}
    />
  );
};

export default TenantGeoHeatmap;
