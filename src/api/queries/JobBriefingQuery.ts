import { graphql } from "react-relay";

/**
 * Per-job briefing — fetched separately from the main JobsQuery so
 * we don't have to thread the briefing payload through every list
 * view that uses jobs. Used by the admin job-detail page (read +
 * edit) and the BA mobile app (read-only).
 */
export const JobBriefingQuery = graphql`
  query JobBriefingQuery($jobId: ID!) {
    jobBriefing(jobId: $jobId) {
      title
      body
      templateUuid
      attachments {
        uuid
        name
        url
        contentType
        size
      }
    }
  }
`;
