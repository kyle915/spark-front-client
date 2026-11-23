import { graphql } from "react-relay";

/**
 * The stored program brief for the report's date range.
 *
 * A brand user only receives a brief Ignite has marked reviewed, or a
 * 30- or 90-day brief whose numbers already checked out, and only while
 * the approved-recap count still matches. Staff also receive drafts.
 * Loading this does not call the model.
 */
export const ProgramBriefQuery = graphql`
  query ProgramBriefQuery($tenantId: ID!, $startDate: String!, $endDate: String!) {
    programBrief(tenantId: $tenantId, startDate: $startDate, endDate: $endDate) {
      enough
      approvedRecaps
      brief {
        id
        startDate
        endDate
        preset
        paragraph
        bullets
        quote
        status
        isDraft
        stale
        autoReviewed
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;

export default ProgramBriefQuery;
