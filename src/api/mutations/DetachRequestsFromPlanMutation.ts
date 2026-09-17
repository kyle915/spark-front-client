import { graphql } from "react-relay";

export const DetachRequestsFromPlanMutation = graphql`
  mutation DetachRequestsFromPlanMutation($input: DetachRequestsFromPlanInput!) {
    detachRequestsFromPlan(input: $input) {
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
