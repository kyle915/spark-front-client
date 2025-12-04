
import { graphql } from "react-relay";

export const EventsQuery = graphql`
    query EventsQuery(
        $filters: EventFiltersInput
        $first: Int
        $after: String
        $last: Int
        $before: String
    ) {
        events(
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
                    startTime
                    endTime
                    address
                    isNational
                    notes
                    request {
                        __typename
                        id
                        uuid
                        name
                        date
                    }
                    tenantId
                    eventType {
                        __typename
                        id
                        uuid
                        name
                    }
                    status {
                        __typename
                        id
                        uuid
                        name
                    }
                }
            }
        }
    }
`;
