import { graphql } from "react-relay";

/**
 * Admin-composed pre-shift briefing for a Job (#191). Sets the job's
 * briefing_title + briefing_body directly (no template copy). The
 * mobile app reads the same data back via `job.briefing` /
 * jobBriefingForEvent, so saving here is what the BA sees in-app.
 *
 * Attachments are supported by the backend (BriefingTemplateAttachmentInput)
 * but left out of the v1 editor UI — title + body only.
 */
export const SetJobBriefingMutation = graphql`
  mutation SetJobBriefingMutation($input: SetJobBriefingInput!) {
    setJobBriefing(input: $input) {
      success
      message
      jobUuid
      title
    }
  }
`;
