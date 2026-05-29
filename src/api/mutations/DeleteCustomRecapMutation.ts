import { graphql } from "react-relay";

/**
 * Delete a `CustomRecap` (tenant-scoped, admin-only on the backend).
 * Custom-template counterpart to DeleteRecapMutation. Returns the
 * deleted uuid so the caller can prune the Relay store / recaps list.
 */
export const DeleteCustomRecapMutation = graphql`
  mutation DeleteCustomRecapMutation($input: DeleteCustomRecapInput!) {
    deleteCustomRecap(input: $input) {
      success
      message
      clientMutationId
      deletedCustomRecapUuid
    }
  }
`;
