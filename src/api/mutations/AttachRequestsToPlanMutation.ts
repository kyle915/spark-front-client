import { graphql } from "react-relay";

export const AttachRequestsToPlanMutation = graphql`
  mutation AttachRequestsToPlanMutation($input: AttachRequestsToPlanInput!) {
    attachRequestsToPlan(input: $input) {
      success
      message
      clientMutationId
      updatedCount
      activationPlan {
        id
        uuid
        name
        requestCount
        pipeline {
          planned
          approved
          staffed
          executed
          verified
        }
      }
    }
  }
`;
