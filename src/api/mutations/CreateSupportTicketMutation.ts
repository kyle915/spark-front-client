import { graphql } from "react-relay";

/**
 * Open a support ticket from the Help page.
 *
 * subject / body are required; category is an optional free-string the UI
 * constrains to a small set ("question" / "bug" / "billing" / "other"). The
 * server stamps status / createdAt and echoes the created ticket back so the
 * form can confirm and clear. message is a human-readable result string used
 * for both success and failure toasts.
 */
export const CreateSupportTicketMutation = graphql`
  mutation CreateSupportTicketMutation($input: CreateSupportTicketInput!) {
    createSupportTicket(input: $input) {
      success
      message
      clientMutationId
      ticket {
        id
        uuid
        subject
        status
        createdAt
      }
    }
  }
`;
