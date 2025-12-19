import { graphql } from "react-relay";

export const FileTypesQuery = graphql`
    query FileTypesQuery {
        fileTypes {
            edges {
                node {
                    id
                    uuid
                    name
                    extension
                }
            }
        }
    }
`;
