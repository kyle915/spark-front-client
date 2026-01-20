import { graphql } from "react-relay";

export const ApproveEventMutation = graphql`
    mutation ApproveEventMutation($input: ApproveEventInput!) {
        approveEvent(input: $input) {
            success
            message
            clientMutationId
        }
    }
`;
