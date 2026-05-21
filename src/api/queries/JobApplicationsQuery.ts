import { graphql } from "react-relay";

/**
 * Admin-facing per-job applicant roster. Used by the Job detail page
 * to show who's applied so the admin can accept (assign) or decline.
 */
export const JobApplicationsQuery = graphql`
  query JobApplicationsQuery($jobId: ID!) {
    jobApplications(jobId: $jobId) {
      uuid
      status
      note
      appliedAt
      decidedAt
      ambassadorUuid
      ambassadorFirstName
      ambassadorLastName
      ambassadorEmail
    }
  }
`;
