export const PUBLIC_TENANT_QUERY = `
  query PublicTenantQuery($requestUrlName: String!) {
    tenantPublic(requestUrlName: $requestUrlName) {
      id,
      uuid,
      name,
      image,
      requestUrlName
    }
  }
`;
