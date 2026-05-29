import { graphql } from "react-relay";

export const CreateAnnouncementMutation = graphql`
  mutation CreateAnnouncementMutation($input: CreateAnnouncementInput!) {
    createAnnouncement(input: $input) {
      success
      message
      announcement {
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
  }
`;
