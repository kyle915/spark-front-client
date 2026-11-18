import { graphql } from "react-relay";

/** Disconnect an AI app. Its access tokens stop working at once. */
export const RevokeAiConnectionMutation = graphql`
  mutation RevokeAiConnectionMutation($id: ID!) {
    revokeAiConnection(id: $id) {
      ok
      message
    }
  }
`;
