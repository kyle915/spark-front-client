import { graphql } from "react-relay";

/**
 * Recipient picker source for the broadcast composer: the active
 * tenant's ambassadors AND ambassador groups in one round-trip. Both
 * lists are tenant-scoped via filters.tenantId (the same scoping the
 * recap pickers use), so the composer can never target another brand's
 * BAs/groups.
 */
export const ChatRecipientsQuery = graphql`
  query ChatRecipientsQuery(
    $ambassadorFilters: AmbassadorFiltersInput
    $groupFilters: AmbassadorGroupFiltersInput
  ) {
    ambassadors(filters: $ambassadorFilters, first: 500) {
      edges {
        node {
          id
          uuid
          isActive
          user {
            firstName
            lastName
            email
          }
        }
      }
    }
    ambassadorGroups(filters: $groupFilters, first: 200) {
      edges {
        node {
          id
          uuid
          name
          members {
            id
          }
        }
      }
    }
  }
`;
