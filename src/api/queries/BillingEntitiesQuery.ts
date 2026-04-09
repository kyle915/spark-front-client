import { graphql } from "react-relay";

export const BillingEntitiesQuery = graphql`
  query BillingEntitiesQuery(
    $filters: BillingEntityFiltersInput
    $q: String
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    billingEntities(
      filters: $filters
      q: $q
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        cursor
        node {
          id
          uuid
          name
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;
