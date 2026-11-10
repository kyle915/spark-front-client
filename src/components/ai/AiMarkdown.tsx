import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

/**
 * Shared renderer for AI-generated answers.
 *
 * The Ask-AI surfaces (the tenant Ask-AI modal in <AskAiButton> and the
 * campaign Q&A card in CampaignReportAdminView) get markdown back from the
 * model — `##`/`###` headings, `**bold**`, and `-`/`*` bullet lists. Rendered
 * as raw text the user sees literal `**` and `###`, so we run the answer
 * through react-markdown here instead.
 *
 * Styling is scoped to the answer block only (every node is styled inline /
 * with a local class — we never touch global element styles) and tuned for the
 * dark workspace theme: readable body text in --spark-text, sensibly-sized
 * headings, real bullet/number lists with hanging indents, and comfortable
 * line spacing. Both surfaces render through this one component so the pop-up
 * and the campaign Ask format identically.
 *
 * Only CommonMark is needed for the shapes the model emits (headings, bold,
 * emphasis, bullet/ordered lists, links, code) so no remark/rehype plugins are
 * pulled in.
 */

const headingStyle: React.CSSProperties = {
  color: "var(--spark-text)",
  letterSpacing: "-0.01em",
  lineHeight: 1.25,
};

const components: Components = {
  // Headings — scaled down from browser defaults so an `##`/`###` reads as a
  // section label inside the answer card, not a page title.
  h1: ({ children }) => (
    <h3
      className="text-lg font-bold mt-4 mb-1.5 first:mt-0"
      style={headingStyle}
    >
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4
      className="text-base font-bold mt-4 mb-1.5 first:mt-0"
      style={headingStyle}
    >
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5
      className="text-sm font-bold mt-3 mb-1 first:mt-0"
      style={headingStyle}
    >
      {children}
    </h5>
  ),
  h4: ({ children }) => (
    <h6
      className="text-sm font-semibold mt-3 mb-1 first:mt-0"
      style={headingStyle}
    >
      {children}
    </h6>
  ),
  h5: ({ children }) => (
    <h6
      className="text-sm font-semibold mt-3 mb-1 first:mt-0"
      style={headingStyle}
    >
      {children}
    </h6>
  ),
  h6: ({ children }) => (
    <h6
      className="text-sm font-semibold mt-3 mb-1 first:mt-0"
      style={headingStyle}
    >
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed my-2 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold" style={{ color: "var(--spark-text)" }}>
      {children}
    </strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1 text-sm leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1 text-sm leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
      style={{ color: "var(--spark-lime)" }}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="my-2 pl-3 text-sm italic"
      style={{
        borderLeft: "2px solid var(--spark-border)",
        color: "var(--spark-text-secondary)",
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code
      className="mono text-[12px] px-1 py-0.5 rounded"
      style={{ background: "rgba(255,255,255,0.08)" }}
    >
      {children}
    </code>
  ),
  hr: () => (
    <hr className="my-3" style={{ borderColor: "var(--spark-border)" }} />
  ),
};

const AiMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <div style={{ color: "var(--spark-text)" }}>
    <ReactMarkdown components={components}>{children}</ReactMarkdown>
  </div>
);

export default memo(AiMarkdown);
