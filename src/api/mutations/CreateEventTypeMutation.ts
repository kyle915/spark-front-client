import { graphql } from "react-relay";

export const CreateEventTypeMutation = graphql`
  mutation CreateEventTypeMutation($input: CreateEventTypeInput!) {
    createEventType(input: $input) {
      success
      message
      clientMutationId
      eventType {
        id
        uuid
        name
        isDefault
        tenantId
      }
    }
  }
`;
