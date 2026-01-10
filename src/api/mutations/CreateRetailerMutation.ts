import { graphql } from "react-relay";

export const CreateRetailerMutation = graphql`
    mutation CreateRetailerMutation($input: CreateRetailerInput!) {
        createRetailer(input: $input) {
            success
            message
            retailer {
                id
                uuid
                name
                address
                location {
                    id
                    name
                }
            }
        }
    }
`;
