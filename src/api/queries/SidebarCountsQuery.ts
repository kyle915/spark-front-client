import { graphql } from "react-relay";

/**
 * Integer sidebar badges + a tiny 48h alert-candidate list.
 *
 * The sidebar is mounted on every admin page. It used to download up to
 * 2,000 Request rows (even a skinny selection) just to tally tracker /
 * approvals / recaps-due. Those are server scalars now, matching
 * pendingWalkupCount. Alerts still need per-row keys for localStorage
 * read-state, so we fetch only the last-48h candidates — not the tenant.
 */
export const SidebarCountsQuery = graphql`
  query SidebarCountsQuery($tenantId: ID) {
    sidebarRequestCounts(tenantId: $tenantId) {
      tracker
      approvals
      approvalsSlaBreach
      upcoming
      done30d
      recapsDue
    }
    sidebarAlertCandidates(tenantId: $tenantId) {
      id
      createdAt
      updatedAt
      statusSlug
    }
    pendingWalkupCount(tenantId: $tenantId)
  }
`;
