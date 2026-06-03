import { graphql } from "react-relay";

/**
 * Archive (soft-delete) a tenant gig template (#265). Powers the inline
 * "Archive" action in the Manage templates panel. Refetch `gigTemplates`
 * after success so the archived template drops out of the picker.
 */
export const ArchiveGigTemplateMutation = graphql`
  mutation ArchiveGigTemplateMutation($input: ArchiveGigTemplateInput!) {
    archiveGigTemplate(input: $input) {
      success
      message
    }
  }
`;
