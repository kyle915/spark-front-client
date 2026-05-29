import { graphql } from "react-relay";

/**
 * Inline "+ Create BA" from the recap "FILLING FOR A BA?" picker.
 *
 * When the roster has no match for a typed name, the admin can create the
 * BA in the ACTIVE tenant on the spot and have the recap filed against the
 * new Ambassador. Reuses `createAmbassadorWithUser` (the admin BA-creation
 * mutation) rather than inventing a new one.
 *
 * NOTE on scope: this codebase has no "profile-only" ambassador — the
 * Ambassador.user FK is non-null, and `createAmbassadorWithUser` is the
 * only path that creates an Ambassador. So it DOES create a login account:
 * email is required, a temp password is auto-generated server-side, and
 * the BA is flagged requires_password_change (no activation email on the
 * admin-created path). Name-only creation isn't possible here; admins who
 * don't have an email use the write-in (externalBaName) instead.
 *
 * Returns the new Ambassador's Relay `id` so the form can immediately
 * select it as `ambassadorId`.
 */
export const CreateAmbassadorWithUserMutation = graphql`
  mutation CreateAmbassadorWithUserMutation(
    $input: CreateAmbassadorWithUserInput!
  ) {
    createAmbassadorWithUser(input: $input) {
      success
      message
      ambassador {
        id
        uuid
        user {
          firstName
          lastName
          email
        }
      }
    }
  }
`;
