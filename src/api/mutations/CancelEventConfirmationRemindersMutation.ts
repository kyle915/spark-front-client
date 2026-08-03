import { graphql } from "react-relay";

/**
 * Stop the 24h/3h reminders for one confirmation (the shift was called off).
 *
 * Marks it cancelled rather than deleting it, so the record of what was
 * already emailed to the BA survives.
 */
export const CancelEventConfirmationRemindersMutation = graphql`
  mutation CancelEventConfirmationRemindersMutation($uuid: ID!) {
    cancelEventConfirmationReminders(uuid: $uuid) {
      success
      message
      confirmation {
        uuid
        sendReminders
        cancelledAt
      }
    }
  }
`;
