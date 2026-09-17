import { graphql } from "react-relay";

export const UnarchiveCustomRecapMutation = graphql`
  mutation UnarchiveCustomRecapMutation($input: UnarchiveCustomRecapInput!) {
    unarchiveCustomRecap(input: $input) {
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
