import { graphql } from "react-relay";

/**
 * Search the recaps list or the events list with a sentence or a filter.
 * Send `question` to have it read into a filter, or `filter` to search by
 * hand (no model is called). The filter used comes back with the rows, and
 * `ignored` names anything that was asked for and left out.
 */
export const ListSearchQuery = graphql`
  query ListSearchQuery(
    $tenantId: ID!
    $list: String!
    $question: String
    $filter: ListSearchFilterInput
  ) {
    listSearch(tenantId: $tenantId, list: $list, question: $question, filter: $filter) {
      list
      interpreted
      modelAvailable
      ignored
      reason
      total
      filter {
        state
        city
        store
        dateFrom
        dateTo
        status
        activationType
        product
        conditions {
          metric
          op
          value
        }
      }
      rows {
        kind
        uuid
        title
        date
        store
        city
        state
        activationType
        status
        requestUuid
        recapCount
        consumers
        unitsSold
        conversion
      }
    }
  }
`;
