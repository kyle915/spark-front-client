import { graphql } from "react-relay";

/**
 * Full BA TALENT profile for the openable pop-up on the Search talent
 * page. Tenant-scoped server-side (the admin can only open a BA reachable
 * in their active tenant). Carries the contact PII (email + phone) the
 * admin needs to reach the BA — the tenant's own roster.
 */
export const AmbassadorProfileDetailQuery = graphql`
  query AmbassadorProfileDetailQuery($ambassadorUuid: ID!, $tenantId: ID) {
    ambassadorProfileDetail(
      ambassadorUuid: $ambassadorUuid
      tenantId: $tenantId
    ) {
      fullName
      email
      phone
      bio
      college
      inCollege
      headshotUrl
      resumeUrl
      ratingAverage
      ratingCount
      jobsCount
      onTimeRate
      reliabilityScore
      reliabilityLabel
      completedShifts
      droppedShifts
      claimedShifts
      photos {
        uuid
        imageUrl
        caption
      }
      gigHistory {
        eventUuid
        brandName
        venue
        city
        stateCode
        date
        status
      }
    }
  }
`;
