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
