import { graphql } from "react-relay";

/**
 * Other brands consumers named, for one client and date range.
 *
 * Read from comments on approved recaps only, dated by the event. AI tags
 * which comments name another brand and which way the person leaned; the
 * counts are worked out on the server from those tags, a brand that is not
 * written in the comment is dropped, and `quote` is one of the stored
 * comments. `preferOurs`, `preferTheirs` and `neutral` are recaps and add
 * up to `recapCount`.
 *
 * `status` is "ready", "too_few" (too few comments name another brand) or
 * "unavailable". The server keeps the result until the approved comments
 * in the range change.
 */
export const TenantCompetitorMentionsQuery = graphql`
  query TenantCompetitorMentionsQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantCompetitorMentions(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      status
      mentionCommentCount
      recapCount
      commentCount
      truncated
      brands {
        brand
        recapCount
        preferOurs
        preferTheirs
        neutral
        quote
      }
    }
  }
`;
