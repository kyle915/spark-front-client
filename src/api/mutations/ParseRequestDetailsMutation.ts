import { graphql } from "react-relay";

/**
 * Read a pasted email or sheet rows into draft request fields. Staff only.
 * It creates nothing: the drafts pre-fill the Create Request form, which is
 * submitted through the usual createRequest mutation. A blank field means
 * the text did not say; those are listed in `couldNotRead`.
 */
export const ParseRequestDetailsMutation = graphql`
  mutation ParseRequestDetailsMutation($tenantId: ID!, $text: String!) {
    parseRequestDetails(tenantId: $tenantId, text: $text) {
      ok
      message
      truncated
      drafts {
        date
        dateAsTyped
        yearAssumed
        dateWarning
        startTime
        startAsTyped
        endTime
        endAsTyped
        timeAssumed
        storeName
        matchedStoreName
        storeNumber
        streetAddress
        city
        state
        zip
        address
        notes
        products {
          uuid
          name
        }
        unmatchedProducts
        couldNotRead
      }
    }
  }
`;
