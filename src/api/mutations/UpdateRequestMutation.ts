import { graphql } from "react-relay";

export const UpdateRequestMutation = graphql`
    mutation UpdateRequestMutation($input: UpdateRequestInput!) {
        updateRequest(input: $input) {
            success
            message
            clientMutationId
            request {
                id
                name
                date
                startTime
                address
                coordinates
                updatedAt
            }
        }
    }
`;
