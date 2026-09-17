import { graphql } from "react-relay";

export const UnarchiveRecapMutation = graphql`
  mutation UnarchiveRecapMutation($input: UnarchiveRecapInput!) {
    unarchiveRecap(input: $input) {
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
