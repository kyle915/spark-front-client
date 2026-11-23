import { graphql } from "react-relay";

/**
 * 1-click attach a filed walk-up Event onto a MasterTracker request.
 * Same high-confidence rules as link_walkin_recaps_to_requests.
 * Powers the chip on /recaps/missing.
 */
export const AttachWalkupOrphanMutation = graphql`
  mutation AttachWalkupOrphanMutation($input: AttachWalkupOrphanInput!) {
    attachWalkupOrphan(input: $input) {
      success
      message
      linkedCount
      orphanEventUuid
      requestUuid
    }
  }
`;
