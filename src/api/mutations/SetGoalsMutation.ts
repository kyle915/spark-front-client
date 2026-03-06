import { graphql } from "react-relay";
import type { MutationParameters } from "relay-runtime";

export const SetGoalsMutation = graphql`
  mutation SetGoalsMutation($input: SetGoalsInput!) {
    setGoals(input: $input) {
      id
      uuid
      userId
      year
      eventTargetGoal
      consumerSamplingGoal
      brandAwarenessGoal
      purchaseIntentGoal
      femaleParticipationGoal
      firstTimeBuyersGoal
    }
  }
`;

type SetGoalsInput = {
  tenantId: string;
  userId: string;
  year: number;
  eventTargetGoal?: number | null;
  consumerSamplingGoal?: number | null;
  brandAwarenessGoal?: number | null;
  purchaseIntentGoal?: number | null;
  femaleParticipationGoal?: number | null;
  firstTimeBuyersGoal?: number | null;
};

export interface SetGoalsMutationType extends MutationParameters {
  response: {
    readonly setGoals: {
      readonly id: string;
      readonly uuid: string;
      readonly userId: string;
      readonly year: number;
      readonly eventTargetGoal: number | null;
      readonly consumerSamplingGoal: number | null;
      readonly brandAwarenessGoal: number | null;
      readonly purchaseIntentGoal: number | null;
      readonly femaleParticipationGoal: number | null;
      readonly firstTimeBuyersGoal: number | null;
    };
  };
  variables: {
    input: SetGoalsInput;
  };
  rawResponse: {
    setGoals: {
      id: string;
      uuid: string;
      userId: string;
      year: number;
      eventTargetGoal: number | null;
      consumerSamplingGoal: number | null;
      brandAwarenessGoal: number | null;
      purchaseIntentGoal: number | null;
      femaleParticipationGoal: number | null;
      firstTimeBuyersGoal: number | null;
    };
  };
}
