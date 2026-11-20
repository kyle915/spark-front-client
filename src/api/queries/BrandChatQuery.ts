import { graphql } from "react-relay";

/**
 * Brand chat on the brand dashboard: the person's own chat for the brand
 * (the asked conversation, or their latest), suggested questions, and how
 * many questions are left this hour. Fetched when the panel opens.
 */
export const BrandChatQuery = graphql`
  query BrandChatQuery($tenantId: ID!, $conversationId: ID) {
    brandChat(tenantId: $tenantId, conversationId: $conversationId) {
      ok
      reason
      brandName
      conversationId
      suggestions
      questionsPerHour
      questionsLeftThisHour
      turns {
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

