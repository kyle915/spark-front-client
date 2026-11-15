import { graphql } from "react-relay";

/**
 * Missing Recaps rows staff dismissed as owing no recap — the "Dismissed"
 * tab on `/recaps/missing`, where a row can be restored. Ignite staff
 * only: the server refuses brand users and ambassadors.
 */
export const DismissedMissingRecapsQuery = graphql`
  query DismissedMissingRecapsQuery($tenantId: ID, $lookbackDays: Int!) {
    dismissedMissingRecaps(tenantId: $tenantId, lookbackDays: $lookbackDays) {
      dismissalUuid
      eventUuid
      eventName
      address
      stateCode
      date
      endTime
      ambassadorName
      ambassadorEmail
      reason
      reasonLabel
      note
      dismissedByName
      dismissedAt
      recapFiled
    }
  }
`;
