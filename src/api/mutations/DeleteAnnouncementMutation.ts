import { graphql } from "react-relay";

export const DeleteAnnouncementMutation = graphql`
  mutation DeleteAnnouncementMutation($input: DeleteAnnouncementInput!) {
    deleteAnnouncement(input: $input) {
      success
      message
    }
  }
`;
