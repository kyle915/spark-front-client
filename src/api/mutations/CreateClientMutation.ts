import { graphql } from "react-relay";

export const CreateClientMutation = graphql`
    mutation CreateClientMutation($input: CreateClientInput!) {
        createClient(input: $input) {
            success
            message
            client {
                id
                uuid
                name
                email
            }
        }
    }
`;
