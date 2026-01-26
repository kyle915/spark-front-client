import { graphql } from "react-relay";

export const UpdateRequestMutation = graphql`
    mutation UpdateRequestMutation($input: UpdateRequestInput!) {
        updateRequest(input: $input) {
            success
            message
            clientMutationId
            request {
                id
                name
                date
                startTime
                endTime
                address
                coordinates
                timezone {
                    id
                    name
                    code
                    offset
                }
                requestType {
                    id
                    name
                }
                status {
                    id
                    name
                }
                retailer {
                    id
                    name
                }
                distributor {
                    id
                    name
                }
                products {
                    id
                    name
                    image
                    productType {
                        id
                        name
                    }
                }
                updatedAt
            }
        }
    }
`;
