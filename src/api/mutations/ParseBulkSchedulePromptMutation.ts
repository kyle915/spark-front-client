import { graphql } from "react-relay";

/**
 * Parse a natural-language bulk scheduling sentence (e.g. "Every Fri & Sat in
 * June at our top 5 Austin HEBs") into matched Account Map store + date rows.
 * Reads only; nothing is created until confirmed via CreateRequestsWaveMutation.
 */
export const ParseBulkSchedulePromptMutation = graphql`
  mutation ParseBulkSchedulePromptMutation($tenantId: ID!, $prompt: String!) {
    parseBulkSchedulePrompt(tenantId: $tenantId, prompt: $prompt) {
      ok
      message
      summary
      truncated
      timeDefaulted
      products {
        uuid
        name
      }
      rows {
        rowKey
        storeKey
        storeName
        storeNumber
        address
        city
        state
        lat
        lng
        date
        weekdayLabel
        startTime
        endTime
        notes
      }
    }
  }
`;
