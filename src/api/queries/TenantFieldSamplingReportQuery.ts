import { graphql } from "react-relay";

/**
 * Consolidated Field Sampling Report — Kyle's ask verbatim: "Samples per
 * hour / Total samples YTD (broken down in each SKU) / Total samples for
 * that week (broken down in each SKU) / Locations hit / What is coming up
 * the next week / Things to note or field call outs," for Feel Free's
 * Guerrilla Field Sampling program. See
 * `recaps/field_sampling_report.py::build_field_sampling_report` on the
 * backend — every number here is deterministic (no AI in the read path);
 * the optional Gemini narrative is a separate on-demand mutation
 * (`GenerateFieldSamplingCalloutSummaryMutation`).
 *
 * `startDate`/`endDate` scope the "this window" figures (SKU breakdown,
 * samples/hour, locations, call-outs) — YTD SKU totals and the 7-day
 * upcoming list are always computed server-side relative to today,
 * independent of this range. `market` optionally restricts to one metro
 * label (see `TenantMetroBreakdownQuery` for how those labels are
 * derived); omitted/null means "all markets."
 */
export const TenantFieldSamplingReportQuery = graphql`
  query TenantFieldSamplingReportQuery(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
    $eventTypeId: ID
    $market: String
  ) {
    tenantFieldSamplingReport(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      eventTypeId: $eventTypeId
      market: $market
    ) {
      samplesPerHour {
        samples
        hours
        perHour
        estimated
      }
      ytdSkuBreakdown {
        mode
        items {
          product
          total
        }
      }
      weekSkuBreakdown {
        mode
        items {
          product
          total
        }
      }
      locationsHit {
        market
        corridor
        date
        address
      }
      upcoming {
        total
        items {
          market
          corridor
          name
          startTime
          address
        }
      }
      callouts {
        market
        corridor
        date
        text
      }
    }
  }
`;
