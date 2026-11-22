import { graphql } from "react-relay";

/** Ignite ops staffing overflow queue — zero client billing. */
export const IgniteStaffingRequestsQuery = graphql`
  query IgniteStaffingRequestsQuery(
    $status: String
    $tenantId: ID
    $first: Int
  ) {
    igniteStaffingRequests(status: $status, tenantId: $tenantId, first: $first) {
      id
      uuid
      tenantId
      tenantName
      status
      source
      title
      activationType
      requestedShiftCount
      requestedBaCount
      requestedDates
      requestedStores
      eventIds
      notes
      opsNotes
      requestedByName
      assignedOpsOwnerName
      acceptedAt
      assignedAt
      completedAt
      createdAt
      updatedAt
    }
  }
`;