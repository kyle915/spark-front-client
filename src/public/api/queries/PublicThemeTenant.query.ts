export const QUERY_PUBLIC_TENANT_THEME = `
  query TenantThemePublic($requestUrlName: String!, $colorScheme: ColorSchemeEnum!) {
    tenantThemePublic(requestUrlName: $requestUrlName, colorScheme: $colorScheme) {
      id
      colorScheme
      cssVariables
      name
    }
  }
`;
