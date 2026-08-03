import { graphql } from "react-relay";

/**
 * Save an event confirmation and (unless `sendNow: false`) email the BA their
 * details from staffing@igniteproductions.co right away.
 *
 * Creates NOTHING but the confirmation row — no Event, no roster booking — so
 * this can't fire the "New shift offered" push, touch Google Calendar or move
 * dashboard KPIs. When `sendReminders` is true the same row drives the
 * automatic 24h-before and 3h-before re-sends.
 *
 * `date` is YYYY-MM-DD and `startTime`/`endTime` are HH:MM, all LOCAL to
 * `timezoneName` — the server combines them into the instant the reminders key
 * off, so the client never has to work out the venue's UTC offset.
 */
export const SendEventConfirmationMutation = graphql`
  mutation SendEventConfirmationMutation($input: SendEventConfirmationInput!) {
    sendEventConfirmation(input: $input) {
      success
      message
      confirmation {
        uuid
        baName
        baEmail
        storeName
        eventTypeLabel
        startsAt
        dateLabel
        timeLabel
        products
        sendReminders
        cancelledAt
        sends {
          stage
          sentAt
          attempts
          lastError
        }
      }
    }
  }
`;
