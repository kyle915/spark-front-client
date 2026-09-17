import { graphql } from "react-relay";

// Mirrors ApproveRecapMutation but for custom-template recaps (Borjomi,
// Girl Beer, …). The backend approve_custom_recap already emails the
// requestor + mapped RMM (with the PDF) — the custom recap view just had
// no way to trigger it. Returns `approved` so Relay updates the view's
// approve state in-place (no reload).
export const ApproveCustomRecapMutation = graphql`
  mutation ApproveCustomRecapMutation($input: ApproveCustomRecapInput!) {
    approveCustomRecap(input: $input) {
      success
      message
      clientMutationId
      customRecap {
        __typename
        id
        uuid
        name
        approved
        approvedAt
        approvedBy {
          firstName
          lastName
          email
        }
        archivedAt
        archiveReason
      }
    }
  }
`;
