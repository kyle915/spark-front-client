import { graphql } from "react-relay";

/**
 * Save the current job's pre-shift briefing (title + body) as a reusable
 * tenant template (#253). The admin names it; the backend snapshots the
 * job's briefing into a BriefingTemplate the whole tenant can apply to
 * future jobs. Refetch `briefingTemplates` after success so the new
 * template shows up in the "Use a template…" picker.
 */
export const SaveJobBriefingAsTemplateMutation = graphql`
  mutation SaveJobBriefingAsTemplateMutation(
    $input: SaveJobBriefingAsTemplateInput!
  ) {
    saveJobBriefingAsTemplate(input: $input) {
      success
      message
      briefingTemplate {
        id
        uuid
        name
        title
        body
      }
    }
  }
`;
