import { graphql } from "react-relay";

/**
 * What the Program KPI tiles show beside their numbers: metrics no form has a
 * field for ("Not tracked on this form") and, per tile, recaps waiting for
 * approval. Loaded after the tiles paint, in its own request, so it never
 * slows TenantKpisQuery.
 */
export const TenantKpiStatusQuery = graphql`
  query TenantKpiStatusQuery($tenantId: ID!, $year: Int) {
    tenantKpiStatus(tenantId: $tenantId, year: $year) {
      untrackedMetrics
      pending {
        metric
        recaps
        wouldAdd
      }
    }
  }
`;
