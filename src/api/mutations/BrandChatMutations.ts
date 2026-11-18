import { graphql } from "react-relay";

/** Ask brand chat one question. Read-only on the server: it can only read
 * the brand's own data. Omit conversationId to start a new chat. */
export const AskBrandChatMutation = graphql`
  mutation BrandChatMutationsAskMutation(
    $tenantId: ID!
    $question: String!
    $conversationId: ID
  ) {
    askBrandChat(
      tenantId: $tenantId
      question: $question
      conversationId: $conversationId
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
