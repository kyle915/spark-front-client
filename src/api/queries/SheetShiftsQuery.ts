import { graphql } from "react-relay";

/**
 * Who the Google staffing sheets have on each shift, beside what Spark has
 * booked. Staff only; read-only — nothing is booked from a sheet.
 */
export const SheetShiftsQuery = graphql`
  query SheetShiftsQuery($date: String, $tenantId: ID) {
    sheetShifts(date: $date, tenantId: $tenantId) {
      uuid
      startText
      endText
      storeName
      baName
      brandName
      sourceLabel
      sheetUrl
      match
      bookedNames
      agrees
    }
  }
`;
