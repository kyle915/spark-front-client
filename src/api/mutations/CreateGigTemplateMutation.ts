import { graphql } from "react-relay";

/**
 * Create a reusable tenant gig template from arbitrary pay/hours/uniform/
 * visibility values (#265). The Post Job modal seeds this from the CURRENT
 * (unsaved) modal fields, so we use createGigTemplate rather than
 * saveJobPostAsGigTemplate (which snapshots a posted job). Refetch
 * `gigTemplates` after success so the new template shows in the picker.
 */
export const CreateGigTemplateMutation = graphql`
  mutation CreateGigTemplateMutation($input: CreateGigTemplateInput!) {
    createGigTemplate(input: $input) {
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
