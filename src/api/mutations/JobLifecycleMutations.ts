import { graphql } from "react-relay";

export const PostJobMutation = graphql`
  mutation JobLifecycleMutations_PostJobMutation($input: PostJobInput!) {
    postJob(input: $input) {
      success
      message
      jobUuid
      lifecycleStatus
    }
  }
`;

export const OpenJobToAllMutation = graphql`
  mutation JobLifecycleMutations_OpenJobToAllMutation(
    $input: OpenJobToAllInput!
  ) {
    openJobToAll(input: $input) {
      success
      message
      jobUuid
      lifecycleStatus
    }
  }
`;

export const AssignAmbassadorToJobMutation = graphql`
  mutation JobLifecycleMutations_AssignMutation(
    $input: AssignAmbassadorToJobInput!
  ) {
    assignAmbassadorToJob(input: $input) {
      success
      message
      jobUuid
      lifecycleStatus
    }
  }
`;
