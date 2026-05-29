import { graphql } from "react-relay";

/**
 * Delete a legacy `Recap` (tenant-scoped, admin-only on the backend).
 * Returns the deleted uuid so the caller can prune the Relay store /
 * recaps list without a full refetch.
 */
export const DeleteRecapMutation = graphql`
  mutation DeleteRecapMutation($input: DeleteRecapInput!) {
    deleteRecap(input: $input) {
      success
      message
      clientMutationId
      deletedRecapUuid
    }
  }
`;
