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
                # Return approved so Relay updates the status chip on the
                # recap view in-place (no reload) after approve/decline.
                approved
                approvedAt
                approvedBy {
                    firstName
                    lastName
                    email
                }
            }
        }
    }
`;
