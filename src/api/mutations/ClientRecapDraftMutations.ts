import { graphql } from "react-relay";

/**
 * Make a first draft of a client recap for a brand and date range. The
 * draft is for staff to edit; nothing is sent or shared.
 */
export const CreateClientRecapDraftMutation = graphql`
  mutation ClientRecapDraftMutationsCreateMutation(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    createClientRecapDraft(tenantId: $tenantId, startDate: $startDate, endDate: $endDate) {
      ok
      reason
      draft {
        uuid
      }
    }
  }
`;

/** Save staff edits: title, summary, takeaways and which photos are used. */
export const UpdateClientRecapDraftMutation = graphql`
  mutation ClientRecapDraftMutationsUpdateMutation(
    $uuid: String!
    $title: String
    $summary: String
    $takeaways: [String!]
    $photoIds: [ID!]
  ) {
    updateClientRecapDraft(
      uuid: $uuid
      title: $title
      summary: $summary
      takeaways: $takeaways
      photoIds: $photoIds
    ) {
      ok
      reason
      draft {
        uuid
        title
        summary
        takeaways
        textSource
        photos {
          id
          url
          category
          caption
          store
          state
          eventDate
          isPick
        }
        updatedAt
      }
    }
  }
`;
