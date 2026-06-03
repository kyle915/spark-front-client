import { graphql } from "react-relay";

/**
 * Snapshot an already-posted job's pay/hours/uniform/visibility into a
 * named, reusable tenant gig template (#265). The backend reads the
 * persisted job, so this is for jobs that are live — the Post Job modal
 * uses createGigTemplate instead (its values are still in local state and
 * the job isn't posted yet). Left wired/available for future surfaces.
 * Refetch `gigTemplates` after success.
 */
export const SaveJobPostAsGigTemplateMutation = graphql`
  mutation SaveJobPostAsGigTemplateMutation(
    $input: SaveJobPostAsGigTemplateInput!
  ) {
    saveJobPostAsGigTemplate(input: $input) {
      success
      message
      gigTemplate {
        uuid
        name
        hourlyRate
        totalHours
        uniformNotes
        defaultOpenToAll
      }
    }
  }
`;
