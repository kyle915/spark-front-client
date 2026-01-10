import { graphql } from "react-relay";

export const EventStatusesQuery = graphql`
query EventStatusesQuery($filters: EventStatusFiltersInput!) {
    eventStatuses(filters: $filters) {
      edges{
        node{
          __typename
          id
          uuid
          name
          slug
          isDefault
          tenantId
        }
      }
    }
  }
`
