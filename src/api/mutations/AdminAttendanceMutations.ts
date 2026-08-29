import { graphql } from "react-relay";

/**
 * Admin TIME CLOCK overrides — manually clock a BA in/out or edit punch times
 * when check-in fails. Clients schema; IsClientOrSparkAdmin.
 */
export const AdminManualClockInMutation = graphql`
  mutation AdminAttendanceMutationsClockInMutation(
    $input: AdminClockPunchInput!
  ) {
    adminManualClockIn(input: $input) {
      success
      message
      clockInAt
      clockOutAt
      attendanceUuid
    }
  }
`;

export const AdminManualClockOutMutation = graphql`
  mutation AdminAttendanceMutationsClockOutMutation(
    $input: AdminClockPunchInput!
  ) {
    adminManualClockOut(input: $input) {
      success
      message
      clockInAt
      clockOutAt
      attendanceUuid
    }
  }
`;

export const AdminEditPunchMutation = graphql`
  mutation AdminAttendanceMutationsEditPunchMutation(
    $input: AdminEditPunchInput!
  ) {
    adminEditPunch(input: $input) {
      success
      message
      clockInAt
      clockOutAt
      attendanceUuid
    }
  }
`;
