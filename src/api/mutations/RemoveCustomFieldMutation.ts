import { graphql } from "react-relay";

/**
 * Admin force-delete a CustomField from a template. The default
 * update_custom_recap_template flow refuses to remove a field once
 * any recap has submitted a value for it — accidental delete would
 * nuke recap data. This mutation is the explicit, focused escape
 * hatch for situations where the field was genuinely a mistake and
 * its values should be discarded too.
 *
 * Pair the call with deleteValues=true to cascade CustomFieldValue
 * rows in the same transaction; leave it false (default) to keep
 * the safety net.
 */
export const RemoveCustomFieldMutation = graphql`
  mutation RemoveCustomFieldMutation($input: RemoveCustomFieldInput!) {
    removeCustomField(input: $input) {
      success
      message
      customField {
        id
        name
      }
    }
  }
`;
