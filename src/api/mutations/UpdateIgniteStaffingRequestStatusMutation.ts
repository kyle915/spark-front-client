import { graphql } from "react-relay";

/** Staff-only staffing request status transitions. */
export const UpdateIgniteStaffingRequestStatusMutation = graphql`
  mutation UpdateIgniteStaffingRequestStatusMutation(
    $input: UpdateIgniteStaffingRequestInput!
  ) {
    updateIgniteStaffingRequestStatus(input: $input) {
      success
      message
      request {
        uuid
        status
        opsNotes
        acceptedAt
        assignedAt
        completedAt
      }
    }
  }
`;