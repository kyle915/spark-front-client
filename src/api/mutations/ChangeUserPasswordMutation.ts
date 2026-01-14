import { graphql } from "react-relay";

export const ChangeUserPasswordMutation = graphql`
    mutation ChangeUserPasswordMutation($input: ChangeUserPasswordInput!) {
        changeUserPassword(input: $input) {
            success
            message
            clientMutationId
        }
    }
`;
