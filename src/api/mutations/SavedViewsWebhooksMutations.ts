import { graphql } from "relay-runtime";

export const UpsertSavedReportViewMutation = graphql`
  mutation SavedViewsWebhooksMutationsUpsertSavedReportViewMutation(
    $name: String!
    $surface: String!
    $filtersJson: String!
    $scheduleEnabled: Boolean!
    $scheduleCadence: String!
    $scheduleDayOfWeek: Int!
    $exportFormat: String!
    $recipientEmails: String!
    $viewUuid: String
    $tenantId: ID
  ) {
    upsertSavedReportView(
      name: $name
      surface: $surface
      filtersJson: $filtersJson
      scheduleEnabled: $scheduleEnabled
      scheduleCadence: $scheduleCadence
      scheduleDayOfWeek: $scheduleDayOfWeek
      exportFormat: $exportFormat
      recipientEmails: $recipientEmails
      viewUuid: $viewUuid
      tenantId: $tenantId
    ) {
      ok
      error
      view {
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
  }
`;

export const DeleteSavedReportViewMutation = graphql`
  mutation SavedViewsWebhooksMutationsDeleteSavedReportViewMutation(
    $viewUuid: String!
    $tenantId: ID
  ) {
    deleteSavedReportView(viewUuid: $viewUuid, tenantId: $tenantId) {
      ok
      error
      targetUuid
    }
  }
`;

export const SendSavedReportViewNowMutation = graphql`
  mutation SavedViewsWebhooksMutationsSendSavedReportViewNowMutation(
    $viewUuid: String!
    $testEmail: String
    $tenantId: ID
  ) {
    sendSavedReportViewNow(
      viewUuid: $viewUuid
      testEmail: $testEmail
      tenantId: $tenantId
    ) {
      ok
      status
      recipients
      rowCount
      periodLabel
      error
    }
  }
`;

export const CreateWebhookEndpointMutation = graphql`
  mutation SavedViewsWebhooksMutationsCreateWebhookEndpointMutation(
    $name: String!
    $url: String!
    $events: [String!]!
    $description: String!
    $tenantId: ID
  ) {
    createWebhookEndpoint(
      name: $name
      url: $url
      events: $events
      description: $description
      tenantId: $tenantId
    ) {
      ok
      error
      endpointUuid
      signingSecret
    }
  }
`;

export const UpdateWebhookEndpointMutation = graphql`
  mutation SavedViewsWebhooksMutationsUpdateWebhookEndpointMutation(
    $endpointUuid: String!
    $name: String
    $url: String
    $events: [String!]
    $description: String
    $isActive: Boolean
    $tenantId: ID
  ) {
    updateWebhookEndpoint(
      endpointUuid: $endpointUuid
      name: $name
      url: $url
      events: $events
      description: $description
      isActive: $isActive
      tenantId: $tenantId
    ) {
      ok
      error
      endpointUuid
    }
  }
`;

export const RotateWebhookSecretMutation = graphql`
  mutation SavedViewsWebhooksMutationsRotateWebhookSecretMutation(
    $endpointUuid: String!
    $tenantId: ID
  ) {
    rotateWebhookSecret(endpointUuid: $endpointUuid, tenantId: $tenantId) {
      ok
      error
      endpointUuid
      signingSecret
    }
  }
`;

export const DeleteWebhookEndpointMutation = graphql`
  mutation SavedViewsWebhooksMutationsDeleteWebhookEndpointMutation(
    $endpointUuid: String!
    $tenantId: ID
  ) {
    deleteWebhookEndpoint(endpointUuid: $endpointUuid, tenantId: $tenantId) {
      ok
      error
      targetUuid
    }
  }
`;

export const SendTestWebhookMutation = graphql`
  mutation SavedViewsWebhooksMutationsSendTestWebhookMutation(
    $endpointUuid: String!
    $tenantId: ID
  ) {
    sendTestWebhook(endpointUuid: $endpointUuid, tenantId: $tenantId) {
      ok
      status
      httpStatus
      durationMs
      error
    }
  }
`;
