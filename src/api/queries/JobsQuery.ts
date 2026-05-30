import { graphql } from "react-relay";

export const JobsQuery = graphql`
  query JobsQuery(
    $filters: JobFiltersInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    jobs(
      filters: $filters
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          __typename
          id
          uuid
          name
          code
          startDate
          endDate
          public
          closed
          ongoing
          national
          lifecycleStatus
          postedAt
          tenantId
          coordinates
          jobTitle {
            __typename
            id
            name
          }
          otherTitle {
            __typename
            id
          }
          event {
            __typename
            id
            uuid
            name
          }
          rate {
            __typename
            id
          }
          description
          address
          briefing {
            title
            body
            templateUuid
          }
        }
      }
    }
  }
`;
