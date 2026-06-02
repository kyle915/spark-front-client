import { graphql } from "react-relay";

/**
 * Move an existing CustomField to a different RecapSection.
 *
 * Used by the template builder's "Manage fields" modal to restructure
 * a template after the fact — re-homing a field that landed in the
 * wrong section without deleting and re-adding it (which would discard
 * any submitted values).
 *
 * NOTE: the backend only allows moving a field into a section that
 * already holds a field from the SAME template, so the destination is
 * always one of the template's own sections. If it refuses, surface
 * the returned message rather than failing loudly.
 */
export const MoveCustomFieldToSectionMutation = graphql`
  mutation MoveCustomFieldToSectionMutation($input: MoveCustomFieldToSectionInput!) {
    moveCustomFieldToSection(input: $input) {
      success
      message
      customField {
        id
        recapSectionId
        recapSection {
          id
          name
        }
      }
    }
  }
`;
