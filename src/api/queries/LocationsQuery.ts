import { graphql } from "react-relay";

export const LocationsQuery = graphql`
    query LocationsQuery($filters: LocationFiltersInput) {
        locations(filters: $filters) {
            edges {
                node {
                    id
                    uuid
                    name
                    code
                    zip
                }
            }
        }
    }
`;
