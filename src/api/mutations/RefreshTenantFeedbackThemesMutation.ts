import { graphql } from "react-relay";

/**
 * Group the comments again for one client and date range. Ignite staff
 * only: the server returns null to anyone else and builds nothing.
 */
export const RefreshTenantFeedbackThemesMutation = graphql`
  mutation RefreshTenantFeedbackThemesMutation(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    refreshTenantFeedbackThemes(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      status
      recapCount
      commentCount
      truncated
      generatedAt
      themes {
        section
        label
        recapCount
        quote
      }
    }
  }
`;
