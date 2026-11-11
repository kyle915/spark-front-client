import { graphql } from "react-relay";

/**
 * One row from each thing a new workspace needs — enough to tell "has any"
 * from "has none" without pulling a list. Feeds the dashboard setup card.
 */
export const SetupChecklistQuery = graphql`
  query SetupChecklistQuery($tenantId: ID!, $userUuid: ID) {
    setupProducts: products(first: 1, filters: { tenantId: $tenantId }) {
      edges {
        node {
          id
        }
      }
    }
    setupTemplates: customRecapTemplates(
      first: 1
      filters: { tenantId: $tenantId }
    ) {
      edges {
        node {
          id
        }
      }
    }
    setupClients: users(
      first: 1
      filters: { tenantId: $tenantId, role: CLIENT }
    ) {
      edges {
        node {
          id
        }
      }
    }
    setupRequests: requests(first: 1, filters: { tenantId: $tenantId }) {
      edges {
        node {
          id
        }
      }
    }
    setupRecaps: customRecaps(first: 1, filters: { tenantId: $tenantId }) {
      edges {
        node {
          id
        }
      }
    }
    tenants(userUuid: $userUuid, first: 500) {
      edges {
        node {
          id
          uuid
          name
          checkinCode
        }
      }
    }
  }
`;

export default SetupChecklistQuery;
