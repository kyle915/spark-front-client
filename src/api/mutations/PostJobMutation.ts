import { graphql } from "react-relay";

/**
 * Post a job live to BAs (#headline).
 *
 * A job is live to BAs exactly when its lifecycle_status == "posted" — the
 * BA job board filters on lifecycle_status, NOT on the `public` flag. So we
 * use the real postJob mutation, which guards "only pending jobs can be
 * posted" and atomically sets lifecycle_status=posted + posted_at + the
 * pay/hours + visibility. (Flipping `public` alone via updateJob never
 * reaches BAs.)
 *
 * The response is a JobLifecycleResponse (success/message/lifecycleStatus/
 * jobUuid), not a full Job, so the caller refetches the job query after a
 * success to reflect the new lifecycle state in the UI.
 */
export const PostJobMutation = graphql`
  mutation PostJobMutation($input: PostJobInput!) {
    postJob(input: $input) {
      success
      message
      lifecycleStatus
      jobUuid
    }
  }
`;
