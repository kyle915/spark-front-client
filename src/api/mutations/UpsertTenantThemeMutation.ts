import { graphql } from "react-relay";

/**
 * Mutation to create or update a tenant theme.
 * This mutation upserts by (tenant, colorScheme), meaning it will update
 * an existing theme if one exists for the given tenant and color scheme,
 * or create a new one if it doesn't exist.
 * 
 * Requires authentication and Spark Admin or Client role.
 */
export const UpsertTenantThemeMutation = graphql`
    mutation UpsertTenantThemeMutation($input: CreateOrUpdateTenantThemeInput!) {
        upsertTenantTheme(input: $input) {
            success
            message
            clientMutationId
            theme {
                id
                name
                colorScheme
                cssVariables
            }
        }
    }
`;


