import { graphql } from "react-relay";

export const ArchiveEventMutation = graphql`
    mutation ArchiveEventMutation($input: ArchiveEventInput!) {
        archiveEvent(input: $input) {
            success
            message
            clientMutationId
        }
    }
`;
