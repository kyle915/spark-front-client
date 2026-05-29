import { graphql } from "react-relay";

/**
 * List CustomRecapTemplates the current admin can see. Used by the
 * Connecteam PDF import modal to pick which template to map the PDF
 * fields onto. Filters server-side scope to the active tenant.
 */
export const CustomRecapTemplatesQuery = graphql`
  query CustomRecapTemplatesQuery(
    $filters: CustomRecapTemplateFiltersInput
    $first: Int
  ) {
    customRecapTemplates(filters: $filters, first: $first) {
      edges {
        node {
          id
          uuid
          name
          tenant {
            id
            name
          }
        }
      }
    }
  }
`;
