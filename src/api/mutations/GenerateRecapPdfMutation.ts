import { graphql } from "react-relay";

export const GenerateRecapPdfMutation = graphql`
    mutation GenerateRecapPdfMutation($input: GenerateRecapPdfInput!) {
        generateRecapPdf(input: $input) {
            success
            message
            clientMutationId
            recapFile {
                id
                uuid
                name
                file
                createdAt
            }
        }
    }
`;
