#!/usr/bin/env node
/**
 * Export Spark's legal documents from the same source the site renders
 * (src/legal/*.ts) so the downloadable PDFs never drift from the pages.
 *
 *   node scripts/legal/export-legal.mjs [--md-out <dir>] [--no-pdf]
 *
 * Writes:
 *   public/legal/terms-of-service.pdf, public/legal/privacy-policy.pdf
 *     (every document with a pdfPath), printed with headless Google Chrome
 *   <md-out>/<slug>.md for every document (default: ./legal-export)
 *
 * Needs Google Chrome installed (macOS path below, or set CHROME_PATH).
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const mdOut = resolve(args.includes("--md-out") ? args[args.indexOf("--md-out") + 1] : join(root, "legal-export"));
const wantPdf = !args.includes("--no-pdf");
const SITE = "https://client.igniteproductions.co";

// 1. Bundle the TS content into a temp ESM module and import it.
const tmp = mkdtempSync(join(tmpdir(), "spark-legal-"));
const bundle = join(tmp, "legal.mjs");
await build({
  entryPoints: [join(root, "src/legal/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "error",
});
const { LEGAL_DOCUMENTS } = await import(pathToFileURL(bundle).href);

// 2. Markdown.
const absolutize = (text) =>
  text.replace(/\]\((\/[^)\s]*)\)/g, (_, p) => `](${SITE}${p})`);

function blockToMd(block) {
  if (typeof block === "string") return absolutize(block);
  if ("list" in block) return block.list.map((i) => `- ${absolutize(i)}`).join("\n");
  if ("caps" in block) return `**${block.caps}**`;
  if ("h" in block) return `#### ${block.h}`;
  const { head, rows } = block.table;
  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function docToMd(doc) {
  const out = [
    `# ${doc.title}`,
    `${doc.platform} · ${doc.company}`,
    `Effective ${doc.effectiveDate} · Last updated ${doc.lastUpdated}`,
    ...doc.intro.map(blockToMd),
  ];
  for (const part of doc.parts) {
    if (part.title) {
      out.push(`## ${part.label}: ${part.title}`);
      if (part.appliesTo) out.push(`_${part.appliesTo}_`);
    }
    for (const s of part.sections) {
      out.push(`### ${s.number}. ${s.title}`, ...s.body.map(blockToMd));
    }
  }
  return out.join("\n\n") + "\n";
}

mkdirSync(mdOut, { recursive: true });
for (const doc of LEGAL_DOCUMENTS) {
  writeFileSync(join(mdOut, `${doc.slug}.md`), docToMd(doc));
  console.log(`md  ${join(mdOut, `${doc.slug}.md`)}`);
}

// 3. PDF via print-ready HTML + headless Chrome.
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s).replace(/\[([^\]]+)\]\((\/?[^)\s]+)\)/g, (_, l, h) =>
    `<a href="${h.startsWith("/") ? SITE + h : h}">${l}</a>`,
  );

function blockToHtml(block) {
  if (typeof block === "string") return `<p>${inline(block)}</p>`;
  if ("list" in block) return `<ul>${block.list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`;
  if ("caps" in block) return `<p class="caps">${esc(block.caps)}</p>`;
  if ("h" in block) return `<h4>${esc(block.h)}</h4>`;
  const { head, rows } = block.table;
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function docToHtml(doc) {
  const body = [];
  for (const part of doc.parts) {
    if (part.title) {
      body.push(`<h2 class="part"><span>${esc(part.label)}</span>${esc(part.title)}</h2>`);
      if (part.appliesTo) body.push(`<p class="applies">${esc(part.appliesTo)}</p>`);
    }
    for (const s of part.sections) {
      body.push(`<section><h3>${esc(s.number)}. ${esc(s.title)}</h3>${s.body.map(blockToHtml).join("")}</section>`);
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)} | ${esc(doc.platform)}</title>
<style>
  @page { size: Letter; margin: 0.8in 0.85in; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1c1917; font-size: 10.5pt; line-height: 1.5; }
  header { border-bottom: 1px solid #d6d3d1; padding-bottom: 14pt; margin-bottom: 14pt; }
  h1 { font-size: 22pt; margin: 0 0 4pt; font-weight: 600; }
  .meta { color: #57534e; font-size: 9.5pt; margin: 2pt 0; }
  h2.part { font-size: 15pt; margin: 22pt 0 2pt; font-weight: 600; page-break-after: avoid; }
  h2.part span { display: block; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: #9a3412; }
  .applies { color: #57534e; font-size: 9.5pt; margin: 0 0 8pt; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; font-weight: 600; page-break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 8pt 0 2pt; font-weight: 600; page-break-after: avoid; }
  p { margin: 0 0 6pt; }
  ul { margin: 0 0 6pt; padding-left: 16pt; }
  li { margin: 0 0 2pt; }
  .caps { font-size: 9.5pt; font-weight: 600; background: #f5f5f4; border: 1px solid #e7e5e4; padding: 6pt 8pt; border-radius: 4pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 4pt 0 8pt; }
  th, td { border: 1px solid #d6d3d1; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f5f5f4; }
  a { color: #9a3412; text-decoration: none; }
</style></head><body>
<header><h1>${esc(doc.title)}</h1>
<p class="meta">${esc(doc.platform)} · ${esc(doc.company)}</p>
<p class="meta">Effective ${esc(doc.effectiveDate)} · Last updated ${esc(doc.lastUpdated)}</p>
<p class="meta">Online version: <a href="${SITE}${doc.path}">${SITE.replace("https://", "")}${doc.path}</a></p></header>
${doc.intro.map(blockToHtml).join("")}
${body.join("\n")}
</body></html>`;
}

if (wantPdf) {
  const chrome =
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}; set CHROME_PATH`);
  for (const doc of LEGAL_DOCUMENTS) {
    if (!doc.pdfPath) continue;
    const html = join(tmp, `${doc.slug}.html`);
    writeFileSync(html, docToHtml(doc));
    const pdf = join(root, "public", doc.pdfPath);
    const started = Date.now();
    // Chrome sometimes exits non-zero after writing the PDF (first-run
    // profile noise); trust the file, not the exit code.
    try {
      execFileSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--user-data-dir=${join(tmp, "chrome")}`,
      `--print-to-pdf=${pdf}`,
      pathToFileURL(html).href,
      ], { stdio: "ignore", timeout: 120000 });
    } catch (err) {
      if (!existsSync(pdf) || statSync(pdf).mtimeMs < started) throw err;
    }
    console.log(`pdf ${pdf}`);
  }
}
