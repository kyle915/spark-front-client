import { graphql } from "react-relay";

/**
 * Accept one group of store names (optionally under a corrected name, or for
 * some of its names only) or dismiss it. Only the display name in reports
 * changes; no retailer, request or event is edited.
 */
export const DecideStoreNameGroupMutation = graphql`
  mutation DecideStoreNameGroupMutation(
    $tenantId: ID!
    $groupKey: String!
    $action: String!
    $canonicalName: String
    $aliasUuids: [ID!]
  ) {
    decideStoreNameGroup(
      tenantId: $tenantId
      groupKey: $groupKey
      action: $action
      canonicalName: $canonicalName
      aliasUuids: $aliasUuids
    ) {
      ok
      message
      changed
      affectedRecords
    }
  }
`;
