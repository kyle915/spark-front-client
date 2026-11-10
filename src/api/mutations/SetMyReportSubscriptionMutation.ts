import { graphql } from "react-relay";

/**
 * Subscribe / unsubscribe the signed-in person to a brand's monthly report
 * email. Only ever changes the caller's own subscription.
 */
export const SetMyReportSubscriptionMutation = graphql`
  mutation SetMyReportSubscriptionMutation($input: SetMyReportSubscriptionInput!) {
    setMyReportSubscription(input: $input) {
      success
      message
      subscribed
    }
  }
`;
