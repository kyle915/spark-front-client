import { graphql } from "react-relay";

/**
 * Mint a signed share token for a tenant's public client-live page. The web
 * builds the shareable URL as `<origin>/live/<token>`.
 */
export const ClientLiveTokenQuery = graphql`
  query ClientLiveTokenQuery($tenantId: ID!) {
    clientLiveToken(tenantId: $tenantId)
  }
`;
