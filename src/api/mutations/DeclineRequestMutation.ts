import { graphql } from "react-relay";

export const DeclineRequestMutation = graphql`
    mutation DeclineRequestMutation($input: DeclineRequestInput!) {
        declineRequest(input: $input) {
            success
            message
            clientMutationId
            request {
                id
                uuid
                name
                status {
                    id
                    name
                    slug
                }
                updatedAt
            }
        }
    }
`;
