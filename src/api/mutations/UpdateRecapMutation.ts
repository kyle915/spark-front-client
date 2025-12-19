import { graphql } from "react-relay";

export const UpdateRecapMutation = graphql`
    mutation UpdateRecapMutation($input: UpdateRecapInput!) {
        updateRecap(input: $input) {
            success
            message
            clientMutationId
            recap {
                id
                uuid
                name
                eventId
                createdAt
                updatedAt
            }
        }
    }
`;
