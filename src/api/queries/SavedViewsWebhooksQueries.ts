import { graphql } from "relay-runtime";

export const SavedReportViewsQuery = graphql`
  query SavedViewsWebhooksQueriesSavedReportViewsQuery(
    $surface: String
    $tenantId: ID
  ) {
    savedReportViews(surface: $surface, tenantId: $tenantId) {
      uuid
      name
      surface
      filtersJson
      filterSummary
      scheduleEnabled
      scheduleCadence
      scheduleDayOfWeek
      scheduleDayLabel
      exportFormat
      recipientEmails
      lastSentAt
      lastSendStatus
      lastSendError
      createdAt
    }
  }
`;

export const WorkspaceWebhooksQuery = graphql`
  query SavedViewsWebhooksQueriesWorkspaceWebhooksQuery($tenantId: ID) {
    workspaceWebhooks(tenantId: $tenantId) {
      tenantName
      canManage
      supportedEvents {
        event
        label
        description
      }
      endpoints {
        uuid
        name
        url
        description
        events
        signingSecretPreview
        isActive
        consecutiveFailures
        lastDeliveryAt
        lastStatusCode
        createdAt
        recentDeliveries {
          uuid
          eventType
          eventId
          status
          httpStatus
          durationMs
          responseExcerpt
          errorMessage
          createdAt
        }
      }
    }
  }
`;
