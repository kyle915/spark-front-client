import { graphql } from "react-relay";

/**
 * Active-tenant Custom Recap Templates WITH their full field structure
 * (sections + fields + field types). Powers the manual "+ New recap"
 * form so it can render the tenant's REAL template — every section and
 * field — instead of the legacy fixed grid.
 *
 * Server-scoped to the active tenant (customRecapTemplates returns an
 * empty page when no tenant is in scope), so it can't surface another
 * client's template. Distinct from the import modal's lean
 * CustomRecapTemplatesQuery (id/name only) because the create form needs
 * the whole field schema to build inputs.
 */
export const CustomRecapTemplatesWithFieldsQuery = graphql`
  query CustomRecapTemplatesWithFieldsQuery(
    $filters: CustomRecapTemplateFiltersInput
    $first: Int
  ) {
    customRecapTemplates(filters: $filters, first: $first) {
      edges {
        node {
          id
          uuid
          name
          productSamples
          salesPerformance
          layout
          tenant {
            id
            name
          }
          eventType {
            id
            name
          }
          customField {
            id
            uuid
            name
            required
            recapSectionId
            recapSection {
              id
              name
            }
            customFieldType {
              id
              name
            }
            options
            placeholder
          }
        }
      }
    }
  }
`;
