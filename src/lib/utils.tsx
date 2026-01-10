import { clsx, type ClassValue } from "clsx"
import { addMonths, differenceInMilliseconds, format } from "date-fns"
import DOMPurify from "dompurify"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

export function formatDate({
  date,
  variant,
}: {
  date: string | Date
  variant: "long" | "short" | "long_with_time" | "short_with_time"
}) {
  if (typeof date === "string") {
    date = new Date(date)
  }

  switch (variant) {
    case "long":
      return format(date, "PPP")
    case "short":
      return format(date, "MM/dd/yyyy")
    case "long_with_time":
      return format(date, "PPP 'at' h:mmaa")
    case "short_with_time":
      return format(date, "MM/dd/yyyy 'at' h:mmaa")
    default:
      return format(date, "MM/dd/yyyy")
  }
}

// Add a hook to make all links open a new tab and to have a class with tailwindcss.
// Also add styling to list elements.
export function sanitizeHtml(html: string) {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if ("target" in node) {
      node.setAttribute("target", "_blank")
      node.setAttribute("rel", "noopener noreferrer")
      node.setAttribute("class", "underline text-primary")
    }
    if (
      !node.hasAttribute("target") &&
      (node.hasAttribute("xlink:href") || node.hasAttribute("href"))
    ) {
      node.setAttribute("xlink:show", "new")
    }

    if (node.tagName === "OL" || node.tagName === "UL") {
      node.setAttribute("class", "list-decimal list-inside space-y-2 pl-4 py-2")
    }
  })

  return DOMPurify.sanitize(html)
}

export function sanitizeHtmlAnchorsOnly(html: string) {
  return DOMPurify.sanitize(sanitizeHtml(html), {
    ALLOWED_TAGS: ["a"],
  }).replace(/&nbsp;/g, "")
}


// export const formatWithDecimals = (value: string, decimals: number): string => {
//   if (value === "") return ""

//   let result = ""
//   let decimalFound = false
//   let decimalCount = 0

//   for (let i = 0; i < value.length; i++) {
//     const char = value[i]
//     const charCode = char.charCodeAt(0)

//     // Allow digits (48-57 ASCII codes).
//     if (charCode >= 48 && charCode <= 57) {
//       if (decimalFound) {
//         // Only allow up to 2 decimal places
//         if (decimalCount < decimals) {
//           result += char
//           decimalCount++
//         }
//       } else result += char
//     }
//     // 46 is ASCII code for '.'
//     else if (charCode === 46 && !decimalFound && decimals > 0) {
//       result += char
//       decimalFound = true
//     }
//   }

//   return result
// }

// export const formatSSN = (value: string): string => {
//   if (value === "") return ""

//   let result = ""

//   for (let i = 0; i < value.length; i++) {
//     const char = value[i]
//     const charCode = char.charCodeAt(0)

//     // Allow digits (48-57).
//     if (charCode >= 48 && charCode <= 57) {
//       result += char
//     }
//     // Do not allow consecutive dashes (45 ASCII code).
//     else if (charCode === 45) {
//       const lastChar = result[result.length - 1]
//       if (lastChar && lastChar.charCodeAt(0) !== 45) {
//         result += char
//       }
//     }
//   }

//   return result
// }

export function getPageCount(totalData: number, perPage: number) {
  return totalData && perPage ? Math.ceil(totalData / perPage) : -1
}

export const time = {
  seconds: (n: number): number => n * 1000,
  minutes: (n: number): number => n * 60 * 1000,
  hours: (n: number): number => n * 60 * 60 * 1000,
  days: (n: number): number => n * 24 * 60 * 60 * 1000,
  months: (n: number): number => {
    const now = new Date()
    const futureDate = addMonths(now, n)
    return differenceInMilliseconds(futureDate, now)
  },
} as const
