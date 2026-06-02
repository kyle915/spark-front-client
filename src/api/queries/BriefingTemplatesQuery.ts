import { graphql } from "react-relay";

/**
 * Per-tenant list of saved BA briefing templates (#253). Tenant-scoped
 * server-side. Used by the pre-shift briefing editor on the admin job
 * detail page to power the "Use a template…" picker, which prefills the
 * briefing title + body so the admin can edit before saving.
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
      createdAt
      updatedAt
    }
  }
`;
