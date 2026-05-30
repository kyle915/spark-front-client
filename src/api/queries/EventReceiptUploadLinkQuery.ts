import { graphql } from "react-relay";

/**
 * Per-event public upload link for the consumer receipt flow.
 *
 * Returns a signed token plus the absolute backend resolve url. The
 * token is what we embed in the public upload-page route so consumers
 * can submit a receipt photo for that event without logging in.
 */
export const EventReceiptUploadLinkQuery = graphql`
  query EventReceiptUploadLinkQuery($eventId: ID!) {
    eventReceiptUploadLink(eventId: $eventId) {
      eventId
      token
      url
    }
  }
`;
