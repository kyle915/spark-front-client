
import { graphql } from "react-relay";

export const EventTypeQuery = graphql`
query EventTypeQuery($filters: EventTypeFiltersInput!) {
    eventTypes(filters: $filters) {
      edges{
        node{
          __typename
          id
          uuid
          name
          isDefault
          tenantId
        }
      }
    }
  }
  `;