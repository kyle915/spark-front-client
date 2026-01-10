export const QUERY_PUBLIC_TIME_ZONES = `
query PublicProductsQuery {
  publicTimezones {
    edges {
      node {
        id
        name
        code
        offset
      }
    }
  }
}
`;
