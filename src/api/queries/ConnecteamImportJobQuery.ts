import { graphql } from "react-relay";

export const ConnecteamImportJobQuery = graphql`
  query ConnecteamImportJobQuery($jobId: String!) {
    connecteamImportJob(jobId: $jobId) {
      jobId
      status
      message
      matchedCount
      unmatchedCount
      imagesAttached
      customRecap {
        id
        uuid
        name
      }
    }
  }
`;
