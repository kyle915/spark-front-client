import { graphql } from "react-relay";

export const BulkApproveRecapsMutation = graphql`
  mutation BulkApproveRecapsMutation($input: BulkApproveRecapsInput!) {
    bulkApproveRecaps(input: $input) {
      success
      message
      updatedCount
    }
  }
`;
