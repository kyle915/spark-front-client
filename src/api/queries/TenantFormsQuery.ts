import { graphql } from "react-relay";

/**
 * Custom form definitions for a tenant, used by the Form Builder
 * (/form-builder). Replaces the old @spark.formBuilder/<tenantId>
 * localStorage store — the backend is now the source of truth.
 *
 * Only `name` + `isPublished` live as top-level columns; everything
 * else (description, internal/external targets, the field list) rides
 * in the opaque `schema` JSON blob. The builder reconstructs its
 * FormDef from { id, name, ...schema, updatedAt }, and derives the
 * internal/external toggles from the blob (isPublished === internal ||
 * external).
 */
export const TenantFormsQuery = graphql`
  query TenantFormsQuery($tenantId: ID!) {
    tenantForms(tenantId: $tenantId) {
      id
      name
      schema
      isPublished
      createdAt
      updatedAt
    }
  }
`;
