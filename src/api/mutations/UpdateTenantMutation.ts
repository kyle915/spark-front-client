import { graphql } from "react-relay";

export const UpdateTenantMutation = graphql`
    mutation UpdateTenantMutation($input: UpdateTenantInput!) {
        updateTenant(input: $input) {
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




