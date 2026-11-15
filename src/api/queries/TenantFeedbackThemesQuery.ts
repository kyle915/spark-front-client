import { graphql } from "react-relay";

/**
 * What consumers said, grouped into themes, for one client and date range.
 *
 * Built from comments on approved recaps only, dated by the event. The
 * grouping is done by AI; `recapCount` on each theme is counted on the
 * server from that grouping, and `quote` is one of the stored comments with
 * ambassador names and contact details taken out.
 *
 * `status` is "ready", "too_few" (not enough comments to group, the model
 * is not asked) or "unavailable". The server keeps the result until the
 * approved comments in the range change, so loading this does not call the
 * model each time.
 */
export const TenantFeedbackThemesQuery = graphql`
  query TenantFeedbackThemesQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantFeedbackThemes(
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
