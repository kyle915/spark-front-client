import { graphql } from "react-relay";

/**
 * Resolve (with a note) or reopen one staff-only recap flag. Ignite staff
 * only — the server refuses anyone else. Never changes the recap itself.
 */
export const ResolveRecapFlagMutation = graphql`
  mutation ResolveRecapFlagMutation($input: ResolveRecapFlagInput!) {
    resolveRecapFlag(input: $input) {
      success
      message
      flag {
        id
        resolvedAt
        resolvedByName
        resolutionNote
        autoCleared
      }
    }
  }
`;
