import { graphql } from "react-relay";

export const CreateEventMutation = graphql`
    mutation CreateEventMutation($input: CreateEventInput!) {
        createEvent(input:$input){
        success
        message
        clientMutationId
        event {
            __typename
            id
            uuid
            name
        }
        }
    }
`
