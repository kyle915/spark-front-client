export const PUBLIC_BILLING_ENTITIES_QUERY = `
  query PublicBillingEntitiesQuery($requestUrlName: String!, $q: String) {
    publicBillingEntities(requestUrlName: $requestUrlName, q: $q) {
      edges {
        node {
          id
          uuid
          name
        }
      }
    }
  }
`;
