import { graphql } from "react-relay";

/**
 * Walk-up self-serve clock-ins for the admin's tenant(s). status="pending"
 * (needs review) | "confirmed" | null (all). Powers the Walk-ups queue.
 */
export const WalkupShiftsQuery = graphql`
  query WalkupShiftsQuery($status: String, $tenantId: ID) {
    walkupShifts(status: $status, tenantId: $tenantId) {
      ambassadorEventUuid
      eventUuid
      eventName
      brandName
      ambassadorName
      ambassadorEmail
      ambassadorPhone
      isNewAccount
      isApproved
      clockInAt
      clockOutAt
      distanceFromVenueMi
      hasRecap
      createdAt
    }
  }
`;
