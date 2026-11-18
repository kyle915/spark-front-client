import { graphql } from "react-relay";

/** One client recap draft. Staff only on the server. */
export const ClientRecapDraftQuery = graphql`
  query ClientRecapDraftQuery($uuid: String!) {
    clientRecapDraft(uuid: $uuid) {
      ok
      reason
      draft {
        uuid
        tenantId
        tenantName
        startDate
        endDate
        period
        title
        summary
        takeaways
        textSource
        numbers {
          label
          value
        }
        weeks {
          label
          value
        }
        stores {
          label
          value
        }
        states {
          label
          value
        }
        quotes
        photos {
          id
          url
          category
          caption
          store
          state
          eventDate
          isPick
        }
        createdAt
        updatedAt
        status
        canEdit
        buildNote
        readyAt
        nextSteps
        deckNumbers {
          label
          value
        }
        noProductNote
        leftOutCount
        leftOutVisits {
          key
          day
          store
          state
          reason
          label
          evidence
          kept
        }
        visitsToCheck {
          key
          day
          store
          state
          reason
          label
          evidence
          kept
        }
        quoteChoices {
          text
          hidden
        }
      }
    }
  }
`;

/** A brand's recent drafts, newest first. Empty for anyone but staff. */
export const ClientRecapDraftsQuery = graphql`
  query ClientRecapDraftQueryListQuery($tenantId: ID!) {
    clientRecapDrafts(tenantId: $tenantId) {
      uuid
      tenantName
      title
      period
      updatedAt
    }
  }
`;

/** The draft rendered as a PDF (base64) for download. Not stored or sent. */
export const ClientRecapDraftPdfQuery = graphql`
  query ClientRecapDraftQueryPdfQuery($uuid: String!) {
    clientRecapDraftPdf(uuid: $uuid) {
      ok
      reason
      filename
      pdfBase64
    }
  }
`;

/**
 * Recap decks Ignite has shared with a brand (staff marked them ready),
 * newest first. A brand user only ever gets their own brand's.
 */
export const ClientRecapDecksQuery = graphql`
  query ClientRecapDraftQueryDecksQuery($tenantId: ID!) {
    clientRecapDecks(tenantId: $tenantId) {
      uuid
      tenantName
      title
      period
      readyAt
    }
  }
`;

/** One shared deck as a PDF (base64). Brand users: ready decks of their own brand only. */
export const ClientRecapDeckPdfQuery = graphql`
  query ClientRecapDraftQueryDeckPdfQuery($uuid: String!) {
    clientRecapDeckPdf(uuid: $uuid) {
      ok
      reason
      filename
      pdfBase64
    }
  }
`;
