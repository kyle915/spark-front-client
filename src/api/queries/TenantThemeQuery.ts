import { graphql } from "react-relay";

/**
 * Query to fetch a tenant theme by tenant ID and color scheme.
 */
export const TenantThemeQuery = graphql`
    query TenantThemeQuery($tenantId: ID!, $scheme: ColorSchemeEnum!) {
        tenantTheme(tenantId: $tenantId, colorScheme: $scheme) {
            id
            name
            colorScheme
            cssVariables
        }
    }
`;
