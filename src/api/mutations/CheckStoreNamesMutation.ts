import { graphql } from "react-relay";

/** Look through one brand's store names now. Stores suggestions only. */
export const CheckStoreNamesMutation = graphql`
  mutation CheckStoreNamesMutation($tenantId: ID!) {
    checkStoreNames(tenantId: $tenantId) {
      ok
      message
      namesChecked
      groupsFound
      aiUsed
    }
  }
`;
