import { graphql } from "react-relay";

/** Write or replace the brief for one range. Staff only. Sends nothing. */
export const GenerateProgramBriefMutation = graphql`
  mutation ProgramBriefMutationsGenerateMutation(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
    $preset: String!
  ) {
    generateProgramBrief(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      preset: $preset
    ) {
      ok
      reason
      brief {
        id
        startDate
        endDate
        preset
        paragraph
        bullets
        quote
        status
        isDraft
        stale
        autoReviewed
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;

/** Keep staff wording when it still uses only the stored figures. */
export const SaveProgramBriefMutation = graphql`
  mutation ProgramBriefMutationsSaveMutation(
    $id: ID!
    $paragraph: String!
    $bullets: [String!]!
    $quote: String!
  ) {
    saveProgramBrief(id: $id, paragraph: $paragraph, bullets: $bullets, quote: $quote) {
      ok
      reason
      brief {
        id
        startDate
        endDate
        preset
        paragraph
        bullets
        quote
        status
        isDraft
        stale
        autoReviewed
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;

/** Mark a brief reviewed, or put it back to draft. Sends nothing. */
export const SetProgramBriefReviewedMutation = graphql`
  mutation ProgramBriefMutationsReviewedMutation($id: ID!, $reviewed: Boolean!) {
    setProgramBriefReviewed(id: $id, reviewed: $reviewed) {
      ok
      reason
      brief {
        id
        startDate
        endDate
        preset
        paragraph
        bullets
        quote
        status
        isDraft
        stale
        autoReviewed
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;
