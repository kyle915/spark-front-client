import { graphql } from "react-relay";

/** Ask brand chat one question (program data + client-safe Spark Help).
 * Read-only on the server: changes nothing except the person's own chat history. */
export const AskBrandChatMutation = graphql`
  mutation BrandChatMutationsAskMutation(
    $tenantId: ID!
    $question: String!
    $conversationId: ID
    $currentPath: String
  ) {
    askBrandChat(
      tenantId: $tenantId
      question: $question
      conversationId: $conversationId
      currentPath: $currentPath
    ) {
      ok
      reason
      conversationId
      questionsLeftThisHour
      turn {
        id
        conversationId
        question
        answer
        status
        createdAt
        sources {
          tool
          label
          detail
          link
          linkLabel
        }
        links {
          label
          url
        }
      }
    }
  }
`;

/** Clear the person's own brand chat history (one chat, or all of it). */
export const ClearBrandChatMutation = graphql`
  mutation BrandChatMutationsClearMutation($tenantId: ID!, $conversationId: ID) {
    clearBrandChat(tenantId: $tenantId, conversationId: $conversationId) {
      ok
      reason
      cleared
    }
  }
`;

/** Direct route-aware Spark Help Q&A (hybrid BM25 + OpenAI embeddings). */
export const AskSparkHelpMutation = graphql`
  mutation BrandChatMutationsAskHelpMutation(
    $question: String!
    $currentPath: String
    $tenantId: ID
    $previewAsClient: Boolean!
  ) {
    askSparkHelp(
      question: $question
      currentPath: $currentPath
      tenantId: $tenantId
      previewAsClient: $previewAsClient
    ) {
      ok
      reason
      answer
      confidence
      matchedVia
      gapLogged
      isAdminScope
      sources {
        title
        routePath
        routeLabel
        audience
        score
      }
    }
  }
`;

/** Flag an Ask Spark turn as unhelpful so Ignite admins see it in Knowledge Gaps. */
export const ReportBrandChatUnhelpfulMutation = graphql`
  mutation BrandChatMutationsReportUnhelpfulMutation(
    $turnId: ID!
    $currentPath: String
  ) {
    reportBrandChatUnhelpful(turnId: $turnId, currentPath: $currentPath) {
      ok
      reason
    }
  }
`;
