import { graphql } from "react-relay";

/** Turn a brand's public program link on or off. Off revokes shared links. */
export const SetProgramShareEnabledMutation = graphql`
  mutation SetProgramShareEnabledMutation($input: SetProgramShareEnabledInput!) {
    setProgramShareEnabled(input: $input) {
      success
      message
      enabled
      token
    }
  }
`;

export default SetProgramShareEnabledMutation;
