import { graphql } from "react-relay";

export const PitchDeckMutationsTogglePinMutation = graphql`
  mutation PitchDeckMutationsTogglePinMutation(
    $photoId: String!
    $pinned: Boolean
    $note: String
  ) {
    togglePhotoWallPin(photoId: $photoId, pinned: $pinned, note: $note) {
      ok
      error
      photoId
      isPinned
      pinnedAt
      pinNote
      pinnedCount
    }
  }
`;

export const PitchDeckMutationsCreateDeckMutation = graphql`
  mutation PitchDeckMutationsCreateDeckMutation(
    $title: String!
    $subtitle: String
    $buyerName: String
    $introNote: String
    $periodStart: String
    $periodEnd: String
    $retailerFilter: String
    $marketFilter: String
    $providerUuid: String
    $includeCosts: Boolean!
    $passcode: String
    $expiresInDays: Int
    $pinnedPhotoIds: [String!]
  ) {
    createBuyerPitchDeck(
      title: $title
      subtitle: $subtitle
      buyerName: $buyerName
      introNote: $introNote
      periodStart: $periodStart
      periodEnd: $periodEnd
      retailerFilter: $retailerFilter
      marketFilter: $marketFilter
      providerUuid: $providerUuid
      includeCosts: $includeCosts
      passcode: $passcode
      expiresInDays: $expiresInDays
      pinnedPhotoIds: $pinnedPhotoIds
    ) {
      ok
      error
      deck {
        uuid
        token
        title
        subtitle
        buyerName
        periodStart
        periodEnd
        retailerFilter
        marketFilter
        includeCosts
        hasPasscode
        expiresAt
        revokedAt
        photoCount
        viewCount
        createdAt
        createdByEmail
      }
    }
  }
`;

export const PitchDeckMutationsRevokeDeckMutation = graphql`
  mutation PitchDeckMutationsRevokeDeckMutation($deckUuid: String!) {
    revokeBuyerPitchDeck(deckUuid: $deckUuid) {
      ok
      error
      deck {
        uuid
        token
        title
        revokedAt
      }
    }
  }
`;
