import { graphql } from "react-relay";

/**
 * Hand off staffing overflow to Ignite ops — no billing checkout on the client.
 */
export const RequestIgniteStaffingMutation = graphql`
  mutation RequestIgniteStaffingMutation($input: RequestIgniteStaffingInput!) {
    requestIgniteStaffing(input: $input) {
      success
      message
      request {
        uuid
        status
        title
        requestedShiftCount
        activationType
      }
    }
  }
`;