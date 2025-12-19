import { graphql } from "react-relay";

export const CreateUserMutation = graphql`
    mutation CreateUserMutation($input: CreateUserInput!) {
        createUser(input: $input) {
            success
            message
            clientMutationId
        }
    }
`;

