import { graphql } from "react-relay";

export const ArchiveCustomRecapMutation = graphql`
  mutation ArchiveCustomRecapMutation($input: ArchiveCustomRecapInput!) {
    archiveCustomRecap(input: $input) {
      success
      message
      clientMutationId
      customRecap {
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
