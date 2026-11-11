import { graphql } from "react-relay";

/** Staff only: count one recap per store per day in a brand's recap totals. */
export const SetBoothDayCountingMutation = graphql`
  mutation SetBoothDayCountingMutation($input: SetBoothDayCountingInput!) {
    setBoothDayCounting(input: $input) {
      success
      message
      enabled
    }
  }
`;

export default SetBoothDayCountingMutation;
