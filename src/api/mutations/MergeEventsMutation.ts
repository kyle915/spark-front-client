import { graphql } from "react-relay";

export const MergeEventsMutation = graphql`
  mutation MergeEventsMutation($input: MergeEventsInput!) {
    mergeEvents(input: $input) {
      success
      message
      deletedEvents
      deletedRequests
      movedSummary
      warnings
    }
  }
`;
