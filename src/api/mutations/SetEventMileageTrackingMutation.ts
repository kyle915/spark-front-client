import { graphql } from "react-relay";

/**
 * Admin: turn GPS mileage tracking on/off for a gig and set the
 * reimbursement rate ($/mile). Ignite-admin gated server-side. Backs the
 * enable toggle in EventMileagePanel.
 */
export const SetEventMileageTrackingMutation = graphql`
  mutation SetEventMileageTrackingMutation(
    $eventId: ID!
    $trackMileage: Boolean!
    $mileageRate: Float
  ) {
    setEventMileageTracking(
      eventId: $eventId
      trackMileage: $trackMileage
      mileageRate: $mileageRate
    ) {
      success
      message
    }
  }
`;
