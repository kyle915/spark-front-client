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

/**
 * Save staff edits: title, summary, takeaways, which photos are used, the
 * next steps, the quotes taken out and the no-product visits counted back in.
 */
export const UpdateClientRecapDraftMutation = graphql`
  mutation ClientRecapDraftMutationsUpdateMutation(
    $uuid: String!
    $title: String
    $summary: String
    $takeaways: [String!]
    $photoIds: [ID!]
    $nextSteps: [String!]
    $hiddenQuotes: [String!]
    $keptVisits: [String!]
  ) {
    updateClientRecapDraft(
      uuid: $uuid
      title: $title
      summary: $summary
      takeaways: $takeaways
      photoIds: $photoIds
      nextSteps: $nextSteps
      hiddenQuotes: $hiddenQuotes
      keptVisits: $keptVisits
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

/**
 * "ready" shares the deck with the brand's users (it shows under their
 * reports; nothing is emailed). "draft" takes it back. Staff only.
 */
export const SetClientRecapDeckStatusMutation = graphql`
  mutation ClientRecapDraftMutationsStatusMutation($uuid: String!, $status: String!) {
    setClientRecapDeckStatus(uuid: $uuid, status: $status) {
      ok
      reason
      draft {
        uuid
        status
        readyAt
      }
    }
  }
`;
