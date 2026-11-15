import { graphql } from "react-relay";

/**
 * Add uploaded rows to a brand's account list. A store already on the list
 * (same name and address) is counted in `duplicates` and left as it is.
 */
export const SaveAccountListMutation = graphql`
  mutation SaveAccountListMutation(
    $tenantId: ID!
    $accounts: [AccountListEntryInput!]!
  ) {
    saveAccountList(tenantId: $tenantId, accounts: $accounts) {
      added
      duplicates
      skipped
      total
      awaitingPosition
    }
  }
`;
