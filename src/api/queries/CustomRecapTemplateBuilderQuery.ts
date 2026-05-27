import { graphql } from "react-relay";

/**
 * Bundle of reference data the Custom Recap Template builder needs:
 *
 *   - All EventTypes for the tenant (template attaches to one)
 *   - All CustomRecapFieldType rows (text / number / photo / etc.)
 *   - All RecapSection rows for the tenant (or none — admin can
 *     create new ones inline via createRecapSection)
 *   - Existing CustomRecapTemplates for the tenant (so the page
 *     can show what's already wired and avoid duplicates)
 *
 * Single round-trip; the page reuses it via store-or-network after
 * the first paint.
 */
export const CustomRecapTemplateBuilderQuery = graphql`
  query CustomRecapTemplateBuilderQuery($tenantId: ID!) {
    eventTypes(first: 200, filters: { tenantId: $tenantId }) {
      edges {
        node {
          id
          uuid
          name
        }
      }
    }
    customRecapFieldTypes(first: 100) {
      edges {
        node {
          id
          uuid
          name
        }
      }
    }
    recapSections(first: 200, tenantId: $tenantId) {
      edges {
        node {
          id
          uuid
          name
        }
      }
    }
    customRecapTemplates(first: 100, filters: { tenantId: $tenantId }) {
      edges {
        node {
          id
          uuid
          name
          eventType {
            id
            name
          }
          customField {
            id
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
          }
        }
      }
    }
  }
`;
