import { graphql } from "react-relay";

/**
 * Email-invite a new Brand Ambassador to the tenant.
 *
 * Backend creates an AmbassadorInvitation row and emails a magic-link
 * activation URL. The BA accepts via `acceptAmbassadorInvitation`
 * (already wired) which finishes account creation.
 *
 * Used from the /talent page header — admins can onboard fresh BAs
 * without leaving the roster. Nevena flagged this gap after Yvette
 * went missing from the list (no path to add a new BA).
 */
export const CreateAmbassadorInvitationMutation = graphql`
  mutation CreateAmbassadorInvitationMutation(
    $input: CreateAmbassadorInvitationInput!
  ) {
    createAmbassadorInvitation(input: $input) {
      success
      message
      invitation {
        id
        email
      }
    }
  }
`;
