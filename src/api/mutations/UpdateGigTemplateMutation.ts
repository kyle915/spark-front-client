import { graphql } from "react-relay";

/**
 * Edit an existing tenant gig template's fields (#265). Powers the inline
 * "Save" action in the Manage templates panel. Refetch `gigTemplates`
 * after success so the picker reflects the edit.
 */
export const UpdateGigTemplateMutation = graphql`
  mutation UpdateGigTemplateMutation($input: UpdateGigTemplateInput!) {
    updateGigTemplate(input: $input) {
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
