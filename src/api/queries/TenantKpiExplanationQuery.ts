import { graphql } from "react-relay";

/**
 * Why one Program KPI tile shows its number. Asked only when someone opens a
 * tile — never part of TenantKpisQuery, so it adds nothing to the dashboard
 * load.
 *
 * `total` comes from the tile's own aggregation on the server, so it always
 * equals the tile. `sources` are the forms (and fields) that feed the number;
 * `how` is "confirmed" (Ignite confirmed the field), "wording" (picked up
 * from the field's wording) or "standard" (a built-in recap number).
 * `excluded` are recaps the tile leaves out, with what they would add.
 * `canFixMapping` is true for Ignite staff only.
 */
export const TenantKpiExplanationQuery = graphql`
  query TenantKpiExplanationQuery($tenantId: ID!, $metric: String!, $year: Int) {
    tenantKpiExplanation(tenantId: $tenantId, metric: $metric, year: $year) {
      metric
      label
      total
      program
      summary
      recapsCounted
      recapsInScope
      recapsWithoutValue
      sources {
        templateId
        templateUuid
        templateName
        recaps
        value
        fields {
          label
          how
          value
        }
      }
      excluded {
        key
        label
        recaps
        wouldAdd
      }
      notTracked
      notTrackedTemplates {
        templateId
        templateUuid
        templateName
      }
      note
      canFixMapping
    }
  }
`;
