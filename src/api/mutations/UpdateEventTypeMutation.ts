import { graphql } from "react-relay";

export const UpdateEventTypeMutation = graphql`
  mutation UpdateEventTypeMutation($input: UpdateEventTypeInput!) {
    updateEventType(input: $input) {
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
