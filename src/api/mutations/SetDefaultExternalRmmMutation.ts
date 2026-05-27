import { graphql } from "react-relay";

/**
 * Pin a single person as the default recipient for ALL external
 * (public-form) requests on the tenant. When set, every public-form
 * request routes to this RMM instead of falling through to the
 * territory-based routing rules.
 *
 * Passing an empty / null userId clears the override and restores
 * territory routing.
 */
export const SetDefaultExternalRmmMutation = graphql`
  mutation SetDefaultExternalRmmMutation($input: SetDefaultExternalRmmInput!) {
    setDefaultExternalRmm(input: $input) {
      success
      message
      tenant {
        id
        defaultExternalRmm {
          id
          uuid
          email
          firstName
          lastName
        }
      }
    }
  }
`;
