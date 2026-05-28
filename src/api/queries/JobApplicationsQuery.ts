import { graphql } from "react-relay";

/**
 * Admin applicant-review list for a single Job (#181). Returns every
 * application row (newest first) with the applicant's name/email/status
 * and the ambassador id needed to accept one via assignAmbassadorToJob.
 */
export const JobApplicationsQuery = graphql`
  query JobApplicationsQuery($jobId: ID!) {
    jobApplications(jobId: $jobId) {
      uuid
      status
      note
      appliedAt
      decidedAt
      ambassadorId
      ambassadorFirstName
      ambassadorLastName
      ambassadorEmail
      ambassadorUuid
    }
  }
`;
