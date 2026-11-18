import { graphql } from "react-relay";

/**
 * The signed-in person's connected AI apps (Claude, ChatGPT, ...) through
 * the official Spark MCP connection, plus the connector URL to paste into
 * the AI app. Ignite admins get everyone's connections (isAdminView, with
 * userEmail filled in) so staff can disconnect any of them.
 */
export const MyAiConnectionsQuery = graphql`
  query MyAiConnectionsQuery {
    myAiConnections {
      connectorUrl
      dailyCallLimit
      isAdminView
      connections {
        id
        appName
        brandName
        userEmail
        createdAt
        lastUsedAt
        callsLast30Days
      }
    }
  }
`;
