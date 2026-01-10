import { graphql } from "react-relay";

export const CreateDistributorMutation = graphql`
    mutation CreateDistributorMutation($input: CreateDistributorInput!) {
        createDistributor(input: $input) {
            success
            message
            distributor {
                id
                uuid
                name
                email
                location {
                    id
                    name
                }
            }
        }
    }
`;
