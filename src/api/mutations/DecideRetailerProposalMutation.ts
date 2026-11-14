import { graphql } from "react-relay";

// Accept (optionally with a corrected name) or dismiss Spark's suggested
// retailer for an event that has none.
export const DecideRetailerProposalMutation = graphql`
  mutation DecideRetailerProposalMutation($input: DecideRetailerProposalInput!) {
    decideRetailerProposal(input: $input) {
      success
      message
      retailerName
    }
  }
`;
