import { graphql } from "react-relay";

/** Show a combined store name on its own again. */
export const UndoStoreNameAliasMutation = graphql`
  mutation UndoStoreNameAliasMutation($tenantId: ID!, $aliasUuid: ID!) {
    undoStoreNameAlias(tenantId: $tenantId, aliasUuid: $aliasUuid) {
      ok
      message
      changed
    }
  }
`;
