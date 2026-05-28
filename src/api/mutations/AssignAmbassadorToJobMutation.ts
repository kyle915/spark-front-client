import { graphql } from "react-relay";

/**
 * Admin accepts a specific applicant (#181). Flips their application to
 * accepted, declines the other applicants, and moves the job to filled.
 * The declined BAs get an "application declined" push; the accepted BA
 * gets a "you got it" push (wired backend-side).
 */
export const AssignAmbassadorToJobMutation = graphql`
  mutation AssignAmbassadorToJobMutation(
    $input: AssignAmbassadorToJobInput!
  ) {
    assignAmbassadorToJob(input: $input) {
      success
      message
      jobUuid
      lifecycleStatus
    }
  }
`;
