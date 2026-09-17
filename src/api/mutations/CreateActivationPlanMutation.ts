import { graphql } from "react-relay";

export const CreateActivationPlanMutation = graphql`
  mutation CreateActivationPlanMutation($input: CreateActivationPlanInput!) {
    createActivationPlan(input: $input) {
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
