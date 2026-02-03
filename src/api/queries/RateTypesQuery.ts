import { graphql } from "react-relay";

export const RateTypesQuery = graphql`
  query RateTypesQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $q: String
    $filters: RateTypeFiltersInput
  ) {
    rateTypes(first: $first, after: $after, last: $last, before: $before, q: $q, filters: $filters) {
      edges {
        node {
          id
          uuid
          name
          tenantId
        }
      }
    }
  }
`;
