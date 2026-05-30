import { graphql } from "react-relay";

/**
 * Update a job's core fields from the Job detail edit modal (#edit).
 *
 * UpdateJobInput requires the job's core non-null fields (id, name,
 * description, code, address, public/closed/national/ongoing,
 * jobTitleId, eventId), so the caller does a read-modify-write: echo the
 * current values back for everything it isn't changing.
 *
 * The mutation returns the updated `job` keyed by id, so Relay merges the
 * new values into the store and the detail view reflects the edit without
 * a manual refetch. We select the same fields the detail view reads.
 */
export const UpdateJobMutation = graphql`
  mutation UpdateJobMutation($input: UpdateJobInput!) {
    updateJob(input: $input) {
      success
      message
      job {
        id
        uuid
        name
        description
        code
        address
        startDate
        endDate
        public
        closed
        ongoing
        national
        lifecycleStatus
        postedAt
        coordinates
        jobTitle {
          id
          name
        }
        event {
          id
          name
        }
      }
    }
  }
`;
