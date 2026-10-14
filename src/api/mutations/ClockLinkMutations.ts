import { graphql } from "react-relay";

/** Clock links admin (Walk-ups → Clock links). Ignite staff only. */
export const CreateClockLinkMutation = graphql`
  mutation ClockLinkMutationsCreateMutation($input: CreateClockLinkInput!) {
    createClockLink(input: $input) {
      success
      message
      link {
        id
      }
    }
  }
`;

export const UpdateClockLinkMutation = graphql`
  mutation ClockLinkMutationsUpdateMutation($input: UpdateClockLinkInput!) {
    updateClockLink(input: $input) {
      success
      message
    }
  }
`;

export const SyncClockSheetMutation = graphql`
  mutation ClockLinkMutationsSyncMutation($input: ClockLinkIdInput!) {
    syncClockSheet(input: $input) {
      success
      message
    }
  }
`;

export const DeleteClockSessionMutation = graphql`
  mutation ClockLinkMutationsDeleteSessionMutation($input: DeleteClockSessionInput!) {
    deleteClockSession(input: $input) {
      success
      message
    }
  }
`;
