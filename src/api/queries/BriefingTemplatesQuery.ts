import { graphql } from "react-relay";

/**
 * Per-tenant list of BA briefing templates. Used by the admin Jobs
 * page (Templates button) and the Post Job modal (template picker).
 */
export const BriefingTemplatesQuery = graphql`
  query BriefingTemplatesQuery($tenantId: ID, $includeArchived: Boolean!) {
    briefingTemplates(tenantId: $tenantId, includeArchived: $includeArchived) {
      id
      uuid
      name
      title
      body
      isArchived
      attachments {
        uuid
        name
        url
        contentType
        size
      }
      createdAt
      updatedAt
    }
  }
`;
