import { graphql } from "react-relay";

/**
 * Create a RecapSection inline from the template builder.
 *
 * The builder needs sections to exist before fields can attach to
 * them; if the admin's tenant has none yet (fresh onboarding), this
 * mutation lets them spin one up without leaving the page.
 */
export const CreateRecapSectionMutation = graphql`
  mutation CreateRecapSectionMutation($input: CreateRecapSectionInput!) {
    createRecapSection(input: $input) {
      success
      message
      recapSection {
        id
        uuid
        name
      }
    }
  }
`;
