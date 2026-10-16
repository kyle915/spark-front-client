export const PUBLIC_RETAILER_QUERY = `
  query PublicRetailerQuery($requestUrlName: String!, $filters: RetailerFiltersInput, $q: String, $first: Int) {
    publicRetailers(requestUrlName: $requestUrlName, filters: $filters, q: $q, first: $first) {
      edges {
        node {
          id
          uuid
          name
          address
          tenantId
          location {
            id
            name
            state {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export const PUBLIC_RETAILER_MIX_QUERY = `
  query PublicRetailerMixQuery($requestUrlName: String!) {
    national: publicRetailers(requestUrlName: $requestUrlName, first: 1, filters: { isNational: true }) {
      totalCount
    }
    regional: publicRetailers(requestUrlName: $requestUrlName, first: 1, filters: { isNational: false }) {
      totalCount
    }
  }
`;
