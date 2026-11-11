import { graphql } from "react-relay";

/** Whether the brand's public program link is on, and its token. */
export const ProgramShareLinkQuery = graphql`
  query ProgramShareLinkQuery($tenantId: ID) {
    programShareLink(tenantId: $tenantId) {
      enabled
      token
    }
  }
`;

export default ProgramShareLinkQuery;
