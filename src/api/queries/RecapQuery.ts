import { graphql } from "react-relay";

export const RecapQuery = graphql`
    query RecapQuery($uuid: ID!) {
        recap(uuid: $uuid) {
            id
            uuid
            name
            createdAt
            updatedAt
            event {
                id
                uuid
                name
                tenantId
                startTime
                endTime
                address
                isNational
                notes
                eventType {
                    name
                    isDefault
                }
                request {
                    name
                    date
                    startTime
                    endTime
                    address
                }
            }
            recapFiles {
                id
                uuid
                name
                file
                fileTypeId
                createdAt
            }
            requestStoreManagers {
                id
                uuid
                name
                phone
                createdAt
                updatedAt
            }
            ambassadors {
                id
                uuid
                rating
                address
                userId
                createdAt
                updatedAt
            }
        }
    }
`;
