import { graphql } from "react-relay";

/**
 * "Find ambassadors" on the Staffing Board (Ignite staff only; null for
 * anyone else). Send `question` to have it read into a filter, or `filter`
 * to search by hand. The filter used comes back with the people.
 */
export const StaffingSearchQuery = graphql`
  query StaffingSearchQuery($question: String, $filter: StaffingSearchFilterInput) {
    staffingSearch(question: $question, filter: $filter) {
      interpreted
      modelAvailable
      total
      filter {
        retailer
        city
        state
        brand
        dateFrom
        dateTo
        minShifts
        mustBeFree
      }
      matches {
        ambassadorUuid
        ambassadorId
        name
        shiftsWorked
        stores
        cities
        lastShiftDate
        isFree
        availability
        conflicts {
          eventName
          brandName
          store
          date
          startLocal
          endLocal
          isApproved
        }
      }
    }
  }
`;
