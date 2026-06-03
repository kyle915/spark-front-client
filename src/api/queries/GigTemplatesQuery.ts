import { graphql } from "react-relay";

/**
 * Per-tenant list of saved gig (job-post) templates (#265). Tenant-scoped
 * server-side. Used by the Post Job modal to power the "Use a template…"
 * picker, which prefills the job's pay/hours/uniform/visibility so the
 * admin can edit before posting. Mirrors briefingTemplates.
 */
export const GigTemplatesQuery = graphql`
  query GigTemplatesQuery($tenantId: ID, $includeArchived: Boolean!) {
    gigTemplates(tenantId: $tenantId, includeArchived: $includeArchived) {
      uuid
      name
      hourlyRate
      totalHours
      uniformNotes
      defaultOpenToAll
      isArchived
    }
  }
`;
