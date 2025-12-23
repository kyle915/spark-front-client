import { graphql } from "react-relay";

export const UpdateUserMutation = graphql`
    mutation UpdateUserMutation($input: UpdateUserInput!) {
        updateUser(input: $input) {
            success
            message
            clientMutationId
        }
    }
`;

