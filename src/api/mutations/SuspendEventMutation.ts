import { graphql } from "react-relay";

export const SuspendEventMutation = graphql`
    mutation SuspendEventMutation($input: SuspendEventInput!) {
        suspendEvent(input: $input) {
            success
            message
            clientMutationId
        }
    }
`;
