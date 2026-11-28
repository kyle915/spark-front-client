import { graphql } from "relay-runtime";

export const ExecutiveSnapshotQuery = graphql`
  query RetentionAutomationQueriesExecutiveSnapshotQuery(
    $year: Int
    $month: Int
    $tenantId: ID
  ) {
    executiveSnapshot(year: $year, month: $month, tenantId: $tenantId) {
      tenantName
      canManage
      year
      month
      monthKey
      monthLabel
      priorMonthLabel
      hasActivity
      config {
        enabled
        recipientEmails
        effectiveRecipients
        targetMsrp
        includePhotos
        lastSentAt
        lastSentMonth
        lastSendStatus
        lastSendError
      }
      kpis {
        key
        label
        formattedValue
        deltaLabel
        direction
      }
      topDoors {
        storeName
        market
        stateCode
        recaps
        consumersSampled
        unitsSold
        conversionLabel
      }
      shelf {
        auditedVisits
        osaRatePct
        priceTagRatePct
        oosGapsCount
        missingTagCount
        medianPrice
        targetMsrp
        callouts {
          storeName
          market
          severity
          detail
        }
      }
      themes {
        title
        mentions
        sentiment
        summary
      }
      photos {
        id
        url
        store
        state
        eventDate
        category
        caption
      }
    }
  }
`;

export const RegionalAlertSubscriptionsQuery = graphql`
  query RetentionAutomationQueriesRegionalAlertSubscriptionsQuery($tenantId: ID) {
    regionalAlertSubscriptions(tenantId: $tenantId) {
      tenantName
      defaultEmail
      subscriptions {
        uuid
        name
        isActive
        states
        chains
        alertOos
        alertPriceDrift
        alertMissingTag
        targetMsrp
        driftThresholdPct
        notifyEmail
        recipientEmails
        notifyWebhook
        webhookUrl
        webhookSecretPreview
        lastTriggeredAt
        triggerCount
        createdAt
        recentDeliveries {
          uuid
          triggerKind
          channel
          storeName
          stateCode
          summary
          status
          errorMessage
          createdAt
        }
      }
    }
  }
`;
