import { graphql } from "react-relay";

/** Public clock in/out links (Walk-ups → Clock links). Ignite staff only. */
export const ClockLinksQuery = graphql`
  query ClockLinksQuery {
    clockLinks {
      available
      serviceAccountEmail
      links {
        id
        label
        url
        tenantId
        tenantName
        sheetUrl
        isActive
        createdAt
        sessionCount
        openCount
        lastClockAt
        syncPending
        syncError
      }
    }
  }
`;
