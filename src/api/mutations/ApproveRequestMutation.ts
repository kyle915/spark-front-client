import { graphql } from "react-relay";

export const ApproveRequestMutation = graphql`
    mutation ApproveRequestMutation($input: ApproveRequestInput!) {
        approveRequest(input: $input) {
            success
            message
            clientMutationId
            request {
                __typename
                id
                uuid
                status {
                    __typename
                    id
                    uuid
                    name
                }
            }
            event {
                __typename
                id
                uuid
                name
            }
        }
    }
`;
