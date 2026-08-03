import { graphql } from "react-relay";

/**
 * Everything the "Send Event Confirmation" tab needs to render its form, in
 * one round trip: the SKU picker's options, the tenant's live recap +
 * training links (read from the tenant, so the tab shows the same URLs the
 * email will contain), the timezone list, and the optional shift picker for
 * prefill.
 *
 * `upcomingShiftsForConfirmation` coming back empty is a NORMAL result — most
 * of these shifts are typed straight into the tab and were never in Spark.
 */
export const EventConfirmationFormQuery = graphql`
  query EventConfirmationFormQuery($tenantId: ID!) {
    eventConfirmationFormOptions(tenantId: $tenantId) {
      productOptions
      recapUrl
      trainingUrl
      defaultTimezoneName
      fromEmail
      defaultEventTypeLabel
      eventTypeOptions
      brandName
      hasRecapLink
      hasTrainingLink
      timezones {
        id
        name
        code
      }
    }
    upcomingShiftsForConfirmation(tenantId: $tenantId) {
      eventUuid
      eventName
      storeName
      address
      eventTypeLabel
      startsAt
      endsAt
      timezoneName
      products
      baName
      baEmail
      ambassadorEventUuid
    }
    eventConfirmations(tenantId: $tenantId) {
      uuid
      baName
      baEmail
      storeName
      eventTypeLabel
      startsAt
      dateLabel
      timeLabel
      products
      sendReminders
      cancelledAt
      sends {
        stage
        sentAt
        attempts
        lastError
      }
    }
  }
`;
