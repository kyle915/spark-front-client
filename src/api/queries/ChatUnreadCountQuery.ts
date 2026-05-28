import { graphql } from "react-relay";

export const ChatUnreadCountQuery = graphql`
  query ChatUnreadCountQuery {
    chatUnreadCount
  }
`;
