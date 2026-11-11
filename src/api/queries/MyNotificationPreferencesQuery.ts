import { graphql } from "react-relay";

/** The signed-in person's optional email categories and their choices. */
export const MyNotificationPreferencesQuery = graphql`
  query MyNotificationPreferencesQuery {
    myNotificationPreferences {
      category
      label
      description
      emailEnabled
    }
  }
`;

export default MyNotificationPreferencesQuery;
