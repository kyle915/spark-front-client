/**
 * Shared shape for Spark's public legal documents (Terms of Service, Privacy
 * Policy, Acceptable Use Policy, Data Processing Summary).
 *
 * The same objects feed three outputs, so they never drift apart:
 *   1. the public pages (LegalDocumentView),
 *   2. the downloadable PDFs in public/legal/ (scripts/legal/export-legal.mjs),
 *   3. plain Markdown copies for review (same script).
 *
 * Inline links use Markdown syntax inside strings: "see the [Privacy Policy](/privacy-policy)".
 */
export type LegalBlock =
  /** A paragraph. */
  | string
  /** A bulleted list. */
  | { list: string[] }
  /** A conspicuous paragraph (disclaimers, liability caps, arbitration notice). */
  | { caps: string }
  /** A numbered sub-heading inside a section, e.g. "7.1 Automated access". */
  | { h: string; id?: string }
  /** A simple table (used for the service-provider list). */
  | { table: { head: string[]; rows: string[][] } };

export type LegalSection = {
  id: string;
  /** "7" — rendered before the title. */
  number: string;
  /** Sentence case. */
  title: string;
  body: LegalBlock[];
};

export type LegalPart = {
  id: string;
  /** "Part A" */
  label: string;
  title: string;
  /** One line under the part heading saying who it applies to. */
  appliesTo?: string;
  sections: LegalSection[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  /** Short name used in the cross-document nav. */
  navLabel: string;
  path: string;
  /** Downloadable PDF path under /public, if one is published. */
  pdfPath?: string;
  company: string;
  platform: string;
  effectiveDate: string;
  lastUpdated: string;
  intro: LegalBlock[];
  parts: LegalPart[];
};
