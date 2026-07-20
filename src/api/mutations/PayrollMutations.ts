import { graphql } from "react-relay";

/**
 * Payroll close-out — sign off a BA's worked hours for a pay period, then
 * record the disbursement (paid) once it's made in Wingspan. Spark never moves
 * money; these only record approval/paid state. All three take the same input
 * (period + tenant + a set of ambassador uuids).
 */
export const ApprovePayrollHoursMutation = graphql`
  mutation PayrollMutationsApproveMutation($input: ApprovePayrollInput!) {
    approvePayrollHours(input: $input) {
      success
      message
      count
    }
  }
`;

export const MarkPayrollPaidMutation = graphql`
  mutation PayrollMutationsMarkPaidMutation($input: ApprovePayrollInput!) {
    markPayrollPaid(input: $input) {
      success
      message
      count
    }
  }
`;

export const UnapprovePayrollHoursMutation = graphql`
  mutation PayrollMutationsUnapproveMutation($input: ApprovePayrollInput!) {
    unapprovePayrollHours(input: $input) {
      success
      message
      count
    }
  }
`;
