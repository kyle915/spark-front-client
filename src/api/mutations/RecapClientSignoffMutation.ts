import { graphql } from "react-relay";

export const RecapClientSignoffMutation = graphql`
  mutation RecapClientSignoffMutation($input: RecapClientSignoffInput!) {
    submitRecapClientSignoff(input: $input) {
      success
      message
      recap {
        id
        approved
        clientSignoffStatus
        clientSignoffComment
        clientSignoffAt
      }
      customRecap {
        id
        approved
        clientSignoffStatus
        clientSignoffComment
        clientSignoffAt
      }
    }
  }
`;
