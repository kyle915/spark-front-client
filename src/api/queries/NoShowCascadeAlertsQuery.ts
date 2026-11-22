import { graphql } from "react-relay";

/** Backup cascade alerts for no-show shifts (staff triage). */
export const NoShowCascadeAlertsQuery = graphql`
  query NoShowCascadeAlertsQuery(
    $status: String
    $tenantId: ID
    $first: Int
  ) {
    noShowCascadeAlerts(status: $status, tenantId: $tenantId, first: $first) {
      id
      uuid
      tenantId
      tenantName
      eventId
      eventUuid
      eventName
      triggerReason
      status
      minutesPastStart
      notes
      dispatchedAt
      createdAt
    }
  }
`;