import { graphql } from "react-relay";

/**
 * Up to four things that stand out in a program, found by rule on the
 * server, most significant first. Each has its sentence, the numbers
 * behind it, and the filters for the recaps list that show those recaps.
 */
export const TenantCalloutsQuery = graphql`
  query TenantCalloutsQuery($tenantId: ID!, $startDate: String, $endDate: String) {
    tenantCallouts(tenantId: $tenantId, startDate: $startDate, endDate: $endDate) {
      key
      kind
      text
      numbers {
        label
        value
      }
      link {
        store
        state
        startDate
        endDate
      }
    }
  }
`;
