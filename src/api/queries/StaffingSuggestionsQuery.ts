import { graphql } from "react-relay";

/**
 * Server-ranked "Suggested BAs for this gig" for a single Event.
 *
 * The backend scores + orders the BAs (best-fit first) using rating,
 * brand history, favorite status, availability, reliability and
 * distance, so the client just renders the order it gets back. `score`
 * is 0–100. The `reasons` strings are short, human-readable badges
 * ("4.8★", "12 gigs for this brand", "available", "favorited",
 * "8 mi away", "96% reliable") meant to render as chips.
 * `reliabilityScore` (0–100, null for BAs with no shift history) +
 * `reliabilityLabel` ("Excellent" … "New") back the reliability chip.
 *
 * `limit` caps how many suggestions come back (the caller passes a
 * sensible default; the server defaults to 20). `baId` is the same
 * Ambassador id the invite mutation expects, so a clicked suggestion
 * can be invited directly.
 */
export const StaffingSuggestionsQuery = graphql`
  query StaffingSuggestionsQuery($eventId: ID!, $limit: Int) {
    staffingSuggestions(eventId: $eventId, limit: $limit) {
      baId
      name
      score
      avgRating
      gigsForBrand
      isFavorited
      isAvailable
      distanceMi
      reliabilityScore
      reliabilityLabel
      reasons
    }
  }
`;
