import { graphql } from "react-relay";

export const RequestStoreManagersQuery = graphql`
  query RequestStoreManagersQuery($filters: RequestStoreManagerFiltersInput!) {
    requestStoreManagers(filters: $filters) {
      edges {
        node {
          __typename
          id
          uuid
          name
          phone
          requestId
        }
      }
    }
  }
`;
