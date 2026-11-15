import { graphql } from "react-relay";

/**
 * A brand's uploaded account list, saved on the server (it used to live only
 * in the uploader's browser). Staff may read any brand's; a brand's own users
 * only their own.
 */
export const AccountListQuery = graphql`
  query AccountListQuery($tenantId: ID!) {
    accountListEntries(tenantId: $tenantId) {
      uuid
      name
      address
      city
      state
      zip
      chain
      notes
      lat
      lng
      positionStatus
    }
  }
`;
