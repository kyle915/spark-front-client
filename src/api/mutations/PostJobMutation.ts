import { graphql } from "react-relay";

/**
 * "Post job" — send a pending job live to BAs (#headline).
 *
 * IMPORTANT — schema reality check
 * --------------------------------
 * The task brief assumed a dedicated `postJob` mutation + a
 * `Job.lifecycleStatus` / `Job.postedAt` field. Neither exists in the
 * checked-in client schema (schema_clients.graphql). A stale, untracked
 * generated artifact (JobLifecycleMutations_PostJobMutation.graphql.ts,
 * dated May 20) references a `postJob`/`PostJobInput` that was reverted
 * server-side — relay-compiler errors with "Unknown type 'PostJobInput'"
 * if you try to use it.
 *
 * What the backend actually exposes is `updateJob(UpdateJobInput!)`, and a
 * job is "live to BAs" precisely when `Job.public === true` (the BA job
 * board / myAvailableJobs surfaces public, open jobs). So "post a job" ==
 * flip `public` to true via updateJob — which is exactly what the missing
 * postJob mutation was specced to do ("sets public=true").
 *
 * UpdateJobInput requires the job's core non-null fields, so the caller
 * must echo the current values back alongside `public: true` (read-modify
 * -write). The mutation returns the updated `job` keyed by `id`, so Relay
 * merges the new `public` value into the store and the UI reflects "live"
 * without a manual refetch.
 */
export const PostJobMutation = graphql`
  mutation PostJobMutation($input: UpdateJobInput!) {
    updateJob(input: $input) {
      success
      message
      job {
        id
        uuid
        public
        closed
        ongoing
      }
    }
  }
`;
