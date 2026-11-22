import { graphql } from "react-relay";

/**
 * Persist door/account logistics notes for a physical store. Surfaced on
 * Store Profile / StoreSheet as well as BA shift briefings and confirmations.
 */
export const SaveStoreLogisticsNotesMutation = graphql`
  mutation SaveStoreLogisticsNotesMutation($input: SaveStoreLogisticsNotesInput!) {
    saveStoreLogisticsNotes(input: $input) {
      success
      message
      storeKey
      logisticsNotes
      logisticsNotesUpdatedAt
    }
  }
`;
