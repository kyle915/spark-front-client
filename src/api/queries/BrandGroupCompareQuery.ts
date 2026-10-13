import { graphql } from "react-relay";

/**
 * Side-by-side per-brand numbers for a brand group. Each row is that
 * brand's own canonical metrics; null when the viewer has no access.
 */
export const BrandGroupCompareQuery = graphql`
  query BrandGroupCompareQuery(
    $tenantId: ID!
    $startDate: Date
    $endDate: Date
    $coActivationsOnly: Boolean!
  ) {
    brandGroupCompare(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      coActivationsOnly: $coActivationsOnly
    ) {
      groupPk
      groupName
      activations
      coActivations
      notes
      brands {
        tenantPk
        name
        recaps
        retailRecaps
        otherRecaps
        coActivationRecaps
        consumersSampled
        unitsSold
        conversionPct
      }
    }
  }
`;
