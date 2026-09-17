import { graphql } from "react-relay";

export const ArchiveRecapMutation = graphql`
  mutation ArchiveRecapMutation($input: ArchiveRecapInput!) {
    archiveRecap(input: $input) {
      success
      message
      clientMutationId
      recap {
        __typename
        id
        uuid
        approved
        archivedAt
        archiveReason
        archivedBy {
          firstName
          lastName
          email
        }
      }
    }
  }
`;
