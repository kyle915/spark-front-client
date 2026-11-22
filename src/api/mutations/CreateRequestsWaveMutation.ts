import { graphql } from "react-relay";

/**
 * Schedule a multi-store wave of approved requests from the Account Map.
 */
export const CreateRequestsWaveMutation = graphql`
  mutation CreateRequestsWaveMutation($input: CreateRequestsWaveInput!) {
    createRequestsWave(input: $input) {
      success
      message
      totalRows
      successCount
      failedCount
      skippedCount
      rolledBack
      errors
      rows {
        rowNumber
        success
        skipped
        message
        requestId
        requestUuid
      }
    }
  }
`;
