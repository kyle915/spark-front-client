import { graphql } from "relay-runtime";

export const UpdateExecutiveSnapshotConfigMutation = graphql`
  mutation RetentionAutomationMutationsUpdateExecutiveSnapshotConfigMutation(
    $enabled: Boolean
    $recipientEmails: String
    $targetMsrp: String
    $includePhotos: Boolean
    $tenantId: ID
  ) {
    updateExecutiveSnapshotConfig(
      enabled: $enabled
      recipientEmails: $recipientEmails
      targetMsrp: $targetMsrp
      includePhotos: $includePhotos
      tenantId: $tenantId
    ) {
      ok
      error
      enabled
      recipientEmails
      targetMsrp
      includePhotos
    }
  }
`;

export const SendExecutiveSnapshotNowMutation = graphql`
  mutation RetentionAutomationMutationsSendExecutiveSnapshotNowMutation(
    $testEmail: String
    $year: Int
    $month: Int
    $tenantId: ID
  ) {
    sendExecutiveSnapshotNow(
      testEmail: $testEmail
      year: $year
      month: $month
      tenantId: $tenantId
    ) {
      ok
      status
      recipients
      monthLabel
      pdfAttached
      error
    }
  }
`;

export const ExportExecutiveSnapshotPdfMutation = graphql`
  mutation RetentionAutomationMutationsExportExecutiveSnapshotPdfMutation(
    $year: Int
    $month: Int
    $tenantId: ID
  ) {
    exportExecutiveSnapshotPdf(year: $year, month: $month, tenantId: $tenantId) {
      ok
      filename
      monthLabel
      pdfBase64
      error
    }
  }
`;

export const UpsertRegionalAlertSubscriptionMutation = graphql`
  mutation RetentionAutomationMutationsUpsertRegionalAlertSubscriptionMutation(
    $name: String!
    $subscriptionUuid: String
    $states: [String!]
    $chains: [String!]
    $alertOos: Boolean!
    $alertPriceDrift: Boolean!
    $alertMissingTag: Boolean!
    $targetMsrp: String
    $driftThresholdPct: String
    $notifyEmail: Boolean!
    $recipientEmails: String!
    $notifyWebhook: Boolean!
    $webhookUrl: String!
    $isActive: Boolean!
    $tenantId: ID
  ) {
    upsertRegionalAlertSubscription(
      name: $name
      subscriptionUuid: $subscriptionUuid
      states: $states
      chains: $chains
      alertOos: $alertOos
      alertPriceDrift: $alertPriceDrift
      alertMissingTag: $alertMissingTag
      targetMsrp: $targetMsrp
      driftThresholdPct: $driftThresholdPct
      notifyEmail: $notifyEmail
      recipientEmails: $recipientEmails
      notifyWebhook: $notifyWebhook
      webhookUrl: $webhookUrl
      isActive: $isActive
      tenantId: $tenantId
    ) {
      ok
      error
      subscriptionUuid
    }
  }
`;

export const DeleteRegionalAlertSubscriptionMutation = graphql`
  mutation RetentionAutomationMutationsDeleteRegionalAlertSubscriptionMutation(
    $subscriptionUuid: String!
    $tenantId: ID
  ) {
    deleteRegionalAlertSubscription(
      subscriptionUuid: $subscriptionUuid
      tenantId: $tenantId
    ) {
      ok
      targetUuid
      error
    }
  }
`;

export const SendTestRegionalAlertMutation = graphql`
  mutation RetentionAutomationMutationsSendTestRegionalAlertMutation(
    $subscriptionUuid: String!
    $tenantId: ID
  ) {
    sendTestRegionalAlert(
      subscriptionUuid: $subscriptionUuid
      tenantId: $tenantId
    ) {
      ok
      sentCount
      failedCount
      channels
      error
    }
  }
`;
