import { graphql } from "react-relay";

export const RequestStatusesQuery = graphql`
query RequestStatusesQuery($filters: RequestStatusFiltersInput!) {
    requestStatuses(filters: $filters) {
      edges{
        node{
          __typename
          id
          uuid
          name
          slug
          isDefault
        }
      }
    }
  }
`;
