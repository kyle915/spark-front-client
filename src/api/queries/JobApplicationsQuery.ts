import { graphql } from "react-relay";

/**
 * Admin applicant-review list for a single Job (#181, #256). Returns
 * every application row (newest first) with the applicant's real
 * name/email/phone/avatar + status, the ambassador id needed to accept
 * one via assignAmbassadorToJob, and the ambassadorUuid used to open the
 * BA profile modal + start a job-scoped DM thread.
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
      ambassadorPhone
      ambassadorImage
      ambassadorUuid
    }
  }
`;
