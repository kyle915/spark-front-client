import { graphql } from "react-relay";

export const UpdateActivationPlanMutation = graphql`
  mutation UpdateActivationPlanMutation($input: UpdateActivationPlanInput!) {
    updateActivationPlan(input: $input) {
      success
      message
      clientMutationId
      activationPlan {
        id
        uuid
        name
        conceptBrief
        startDate
        endDate
        markets
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
