import { graphql } from "react-relay";

/**
 * Bulk-apply every safe orphan walk-up → DUE request link for a tenant.
 * Admin "Attach all safe matches" on /recaps/missing.
 */
export const AttachSafeWalkupOrphansMutation = graphql`
  mutation AttachSafeWalkupOrphansMutation(
    $input: AttachSafeWalkupOrphansInput!
  ) {
    attachSafeWalkupOrphans(input: $input) {
      success
      message
      linkedCount
    }
  }
`;
