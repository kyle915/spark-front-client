import { Fragment, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { LegalBlock, LegalDocument } from "./types";
import { CONTRACTOR_AGREEMENT_LINK, LEGAL_DOCUMENTS } from "./index";
import { holdAppearance } from "@/theme/appearance";

/** Renders "[label](href)" inside a string as links; everything else is text. */
const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function renderInline(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const [whole, label, href] = match;
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      href.startsWith("/") ? (
        <Link key={start} to={href} className="link link-primary">
          {label}
        </Link>
      ) : (
        <a key={start} href={href} className="link link-primary">
          {label}
        </a>
      ),
    );
    last = start + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return <p>{renderInline(block)}</p>;
  }
  if ("list" in block) {
    return (
      <ul className="list-disc pl-5 space-y-1.5 marker:text-base-content/40">
        {block.list.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }
  if ("caps" in block) {
    return (
      <p className="rounded-lg border border-base-300 bg-base-200/60 px-4 py-3 text-[13px] leading-6 font-medium text-base-content">
        {block.caps}
      </p>
    );
  }
  if ("h" in block) {
    return (
      <h4
        id={block.id}
        className="scroll-mt-24 pt-2 text-[15px] font-semibold text-base-content"
      >
        {block.h}
      </h4>
    );
  }
  const { head, rows } = block.table;
  return (
    <>
      {/* Phone: stacked rows */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row, r) => (
          <dl
            key={r}
            className="rounded-lg border border-base-300 px-4 py-3 space-y-1"
          >
            {row.map((cell, c) => (
              <div key={c}>
                <dt className="text-xs font-semibold text-base-content/60">
                  {head[c]}
                </dt>
                <dd>{cell}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      {/* Wider screens: table */}
      <div className="hidden sm:block overflow-hidden rounded-lg border border-base-300">
        <table className="w-full text-left text-[13px] leading-5">
          <thead className="bg-base-200/70 text-base-content">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-base-300 align-top">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`px-3 py-2 ${c === 0 ? "font-medium text-base-content" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();

  // Long-form reading: use the person's light/dark choice (light by default),
  // like the signed-in app, instead of the public pages' dark styling.
  useEffect(() => holdAppearance(), []);

  // The page is lazy-loaded, so the browser's own jump to #anchor happens
  // before the section exists. Scroll once it has rendered.
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ block: "start" });
  }, [pathname, hash]);
  const navItems = [
    ...LEGAL_DOCUMENTS.map((d) => ({ label: d.navLabel, path: d.path })),
    CONTRACTOR_AGREEMENT_LINK,
  ];
  const multiPart = doc.parts.length > 1;

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10 space-y-6">
        {/* Header */}
        <header className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm -ml-2"
              onClick={() =>
                window.history.length > 1 ? navigate(-1) : navigate("/")
              }
            >
              Back
            </button>
            {doc.pdfPath ? (
              <a
                href={doc.pdfPath}
                className="link link-primary text-sm"
                target="_blank"
                rel="noreferrer"
              >
                Download PDF
              </a>
            ) : null}
          </div>

          <nav aria-label="Legal documents" className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const active = item.path === pathname;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-content"
                      : "border-base-300 text-base-content/75 hover:border-base-content/40 hover:text-base-content"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {doc.title}
            </h1>
            <p className="text-sm text-base-content/65">
              {doc.platform} · {doc.company}
            </p>
            <p className="text-sm text-base-content/65">
              Effective {doc.effectiveDate} · Last updated {doc.lastUpdated}
            </p>
          </div>

          <div className="space-y-3 text-[15px] leading-7 text-base-content/85">
            {doc.intro.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

        </header>

        {/* Contents */}
        <nav
          aria-label="Contents"
          className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-8"
        >
          <h2 className="text-base font-semibold mb-3">Contents</h2>
          <div className="space-y-4">
            {doc.parts.map((part) => (
              <div key={part.id}>
                {multiPart ? (
                  <a
                    href={`#${part.id}`}
                    className="block text-sm font-semibold text-base-content mb-1.5"
                  >
                    {part.label}: {part.title}
                  </a>
                ) : null}
                <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {part.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="text-sm text-base-content/75 hover:text-primary"
                      >
                        {s.number}. {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </nav>

        {/* Body */}
        {doc.parts.map((part) => (
          <Fragment key={part.id}>
            {multiPart ? (
              <div id={part.id} className="scroll-mt-24 px-1 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {part.label}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {part.title}
                </h2>
                {part.appliesTo ? (
                  <p className="mt-1 text-sm text-base-content/70">
                    {part.appliesTo}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="rounded-2xl border border-base-300 bg-base-100 divide-y divide-base-300">
              {part.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 p-5 sm:p-8 space-y-3 text-[15px] leading-7 text-base-content/85"
                >
                  <h3 className="text-lg font-semibold text-base-content">
                    {section.number}. {section.title}
                  </h3>
                  {section.body.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </section>
              ))}
            </div>
          </Fragment>
        ))}

        <footer className="px-1 pb-6 text-xs text-base-content/60">
          © {new Date().getFullYear()} {doc.company}. Questions about this
          document: events@igniteproductions.co
        </footer>
      </div>
    </div>
  );
}
