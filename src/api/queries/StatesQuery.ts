import { graphql } from "react-relay";

export const StatesQuery = graphql`
    query StatesQuery(
        $q: String
        $first: Int
        $after: String
        $last: Int
        $before: String
    ) {
        states(q: $q, first: $first, after: $after, last: $last, before: $before) {
            edges {
                cursor
                node {
                    __typename
                    id
                    uuid
                    name
                    code
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
