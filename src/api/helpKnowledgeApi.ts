import { graphql } from "react-relay";

/** Admin-only Spark Help Knowledge Base + Unanswered Questions (Gaps) query. */
export const SparkHelpKnowledgeQuery = graphql`
  query helpKnowledgeApiQuery(
    $audience: String
    $search: String
    $gapStatus: String
  ) {
    sparkHelpKnowledge(
      audience: $audience
      search: $search
      gapStatus: $gapStatus
    ) {
      ok
      reason
      isAdmin
      builtinCount
      embeddedCount
      openGapCount
      articles {
        id
        uuid
        title
        category
        audience
        routePath
        routeLabel
        tags
        body
        sourceKind
        hasEmbedding
        embeddingModel
        isActive
        usageCount
        updatedAt
      }
      gaps {
        id
        uuid
        question
        routePath
        callerRole
        sourceSurface
        reason
        askedCount
        status
        lastAskedAt
        resolvedArticleTitle
      }
    }
  }
`;

/** Admin-only create or edit Spark Help / Ops SOP article (auto-embeds via OpenAI). */
export const UpsertSparkHelpArticleMutation = graphql`
  mutation helpKnowledgeApiUpsertArticleMutation(
    $input: UpsertSparkHelpArticleInput!
  ) {
    upsertSparkHelpArticle(input: $input) {
      ok
      reason
      article {
        id
        uuid
        title
        category
        audience
        routePath
        routeLabel
        tags
        body
        sourceKind
        hasEmbedding
        embeddingModel
        isActive
        usageCount
        updatedAt
      }
    }
  }
`;

/** Admin-only delete Spark Help article. */
export const DeleteSparkHelpArticleMutation = graphql`
  mutation helpKnowledgeApiDeleteArticleMutation($uuid: ID!) {
    deleteSparkHelpArticle(uuid: $uuid) {
      ok
      reason
    }
  }
`;

/** Admin-only resolve a Knowledge Gap by publishing + embedding a Help article. */
export const ResolveSparkHelpGapMutation = graphql`
  mutation helpKnowledgeApiResolveGapMutation(
    $input: ResolveSparkHelpGapInput!
  ) {
    resolveSparkHelpGap(input: $input) {
      ok
      reason
      article {
        id
        uuid
        title
        audience
        hasEmbedding
      }
    }
  }
`;

/** Admin-only dismiss a Knowledge Gap. */
export const DismissSparkHelpGapMutation = graphql`
  mutation helpKnowledgeApiDismissGapMutation($uuid: ID!) {
    dismissSparkHelpGap(uuid: $uuid) {
      ok
      reason
    }
  }
`;

/** Admin-only backfill / refresh OpenAI text-embedding-3-small vectors. */
export const SyncSparkHelpEmbeddingsMutation = graphql`
  mutation helpKnowledgeApiSyncEmbeddingsMutation {
    syncSparkHelpEmbeddings {
      ok
      reason
      articlesChecked
      articlesEmbedded
      builtinEmbedded
    }
  }
`;

/** Admin-only: draft an AI reply inside a `/chat` BA conversation. */
export const DraftChatReplyWithAiMutation = graphql`
  mutation helpKnowledgeApiDraftChatReplyMutation(
    $threadUuid: ID!
    $instruction: String
  ) {
    draftChatReplyWithAi(threadUuid: $threadUuid, instruction: $instruction) {
      ok
      reason
      draft
      confidence
      sources
      missingInfo
    }
  }
`;

/** Admin-only: distill a resolved `/chat` exchange into a PII-scrubbed Help draft. */
export const DistillChatToHelpKnowledgeMutation = graphql`
  mutation helpKnowledgeApiDistillChatMutation(
    $threadUuid: ID!
    $messageUuid: ID!
  ) {
    distillChatToHelpKnowledge(
      threadUuid: $threadUuid
      messageUuid: $messageUuid
    ) {
      ok
      reason
      title
      body
      category
      audience
      tags
      routePath
      routeLabel
    }
  }
`;
