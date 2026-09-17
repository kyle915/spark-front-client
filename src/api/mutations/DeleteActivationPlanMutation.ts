import { graphql } from "react-relay";

export const DeleteActivationPlanMutation = graphql`
  mutation DeleteActivationPlanMutation($input: DeleteActivationPlanInput!) {
    deleteActivationPlan(input: $input) {
      success
      message
      clientMutationId
      activationPlan {
        id
        uuid
        name
      }
    }
  }
`;
