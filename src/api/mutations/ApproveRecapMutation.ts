import { graphql } from "react-relay";

export const ApproveRecapMutation = graphql`
    mutation ApproveRecapMutation($input: ApproveRecapInput!) {
        approveRecap(input: $input) {
            success
            message
            clientMutationId
            recap {
                __typename
                id
                uuid
                name
            }
        }
    }
`;
