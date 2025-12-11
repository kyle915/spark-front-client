import { graphql } from "react-relay";

export const CreateTenantMutation = graphql`
    mutation CreateTenantMutation($input: CreateTenantInput!) {
        createTenant(input: $input) {
            success
            message
            tenant {
                id
                uuid
                name
                requestUrlName
            }
            clientMutationId
        }
    }
`;
