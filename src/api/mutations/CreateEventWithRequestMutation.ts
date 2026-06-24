import { graphql } from "react-relay";

/**
 * Create an Event together with its parent Request in one atomic call.
 *
 * Why this exists for the Connecteam import "+ New event" path:
 * the plain `createEvent` mutation makes a request-less Event, and the
 * Master Tracker lists ONLY Request rows — so a recap imported against
 * a bare event is invisible there. This mutation creates the Request
 * (the canonical record the tracker reads) AND materializes the Event,
 * both forced to "approved" on the server.
 *
 * It is the admin "log event" path: status lands straight on `approved`
 * with NO client/requestor notification (no email, no push) — the recap
 * is for an already-completed activation, so the client is never asked
 * to approve anything. See spark-api create_event_with_request.
 *
 * Returns `event { id }` so the caller can immediately import the PDF
 * against the freshly-materialized event.
 */
export const CreateEventWithRequestMutation = graphql`
  mutation CreateEventWithRequestMutation($input: CreateEventWithRequestInput!) {
    createEventWithRequest(input: $input) {
      success
      message
      clientMutationId
      event {
        __typename
        id
        uuid
        name
      }
      request {
        __typename
        id
        uuid
      }
    }
  }
`;
