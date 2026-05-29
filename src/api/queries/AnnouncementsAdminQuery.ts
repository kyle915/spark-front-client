import { graphql } from "react-relay";

export const AnnouncementsAdminQuery = graphql`
  query AnnouncementsAdminQuery($filters: AnnouncementFiltersInput) {
    announcementsAdmin(filters: $filters) {
      id
      uuid
      title
      body
      audience
      publishedAt
      createdAt
      createdByName
      tenantId
    }
  }
`;
