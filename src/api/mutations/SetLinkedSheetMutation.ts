import { graphql } from "react-relay";

/**
 * Persist the Master-Tracker-linked Google Sheet on the tenant
 * record. Replaces the per-device localStorage that LinkedSheetChip
 * + Settings used to read/write — backend persistence means every
 * teammate sees the same link from every device, and Phase-2 sync
 * workers know which sheet to target.
 *
 * Passing an empty sheetUrl clears the link.
 */
export const SetLinkedSheetMutation = graphql`
  mutation SetLinkedSheetMutation($input: SetLinkedSheetInput!) {
    setLinkedSheet(input: $input) {
      success
      message
      tenant {
        id
        uuid
        linkedSheetUrl
      }
    }
  }
`;
