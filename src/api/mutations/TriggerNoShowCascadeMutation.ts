import { graphql } from "react-relay";

/** Staff-only manual backup cascade for a no-show shift. */
export const TriggerNoShowCascadeMutation = graphql`
  mutation TriggerNoShowCascadeMutation($input: TriggerNoShowCascadeInput!) {
    triggerNoShowCascade(input: $input) {
      success
      message
      created
      alert {
        uuid
        status
        eventId
        eventName
        dispatchedAt
      }
    }
  }
`;