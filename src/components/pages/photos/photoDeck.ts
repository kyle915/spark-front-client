import {
  deckColumns,
  deckPages,
  photoCaption,
  type DeckLayout,
  type GalleryPhoto,
} from "./photoGallery";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );

/**
 * A self-contained, print-ready HTML document: landscape Letter pages with
 * the chosen photos N per page, each captioned with its category and where
 * and when it was taken. Opened in its own window so the app's styles and
 * the browser's print header never bleed into the deck; "Save as PDF" in
 * the print dialog produces the file.
 */
export function buildDeckHtml(opts: {
  title: string;
  subtitle: string;
  photos: readonly GalleryPhoto[];
  perPage: DeckLayout;
}): string {
  const cols = deckColumns(opts.perPage);
  const rows = Math.ceil(opts.perPage / cols);
  const pages = deckPages(opts.photos, opts.perPage);
  const body = pages
    .map(
      (page, i) => `
<section class="page">
  <header><strong>${esc(opts.title)}</strong><span>${esc(opts.subtitle)}</span></header>
  <div class="grid">
    ${page
      .map(
        (p) => `<figure>
      <div class="frame"><img src="${esc(p.url)}" alt="" /></div>
      <figcaption><b>${esc(p.category || "Field photo")}</b>${
        photoCaption(p) ? `<span>${esc(photoCaption(p))}</span>` : ""
      }</figcaption>
    </figure>`,
      )
      .join("\n")}
  </div>
  <footer><span>Ignite Productions</span><span>${i + 1} / ${pages.length}</span></footer>
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(opts.title)} — photo deck</title>
<style>
  @page { size: 11in 8.5in; margin: 0.45in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: #14160f;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
  .page { height: 7.6in; display: flex; flex-direction: column; gap: 0.14in;
    break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: baseline;
    border-bottom: 1px solid #dcddd5; padding-bottom: 0.08in; }
  header strong { font-size: 15pt; letter-spacing: -0.02em; }
  header span { font-size: 9pt; color: #5c6154; }
  .grid { flex: 1; min-height: 0; display: grid; gap: 0.14in;
    grid-template-columns: repeat(${cols}, 1fr);
    grid-template-rows: repeat(${rows}, 1fr); }
  figure { margin: 0; min-height: 0; display: flex; flex-direction: column; gap: 0.05in; }
  .frame { flex: 1; min-height: 0; background: #f1f1ec; border-radius: 6px; overflow: hidden; }
  .frame img { width: 100%; height: 100%; object-fit: ${opts.perPage === 1 ? "contain" : "cover"}; display: block; }
  figcaption { font-size: 8pt; line-height: 1.25; }
  figcaption b { display: block; text-transform: uppercase; letter-spacing: 0.08em; font-size: 7pt; }
  figcaption span { color: #5c6154; }
  footer { display: flex; justify-content: space-between; font-size: 7.5pt; color: #7a7f70; }
  @media screen { body { background: #ecece6; padding: 16px; }
    .page { background: #fff; width: 10.1in; margin: 0 auto 16px; padding: 0.3in; } }
</style>
</head>
<body>
${body}
<script>
  // Print once every image has loaded (or failed), so no page is blank.
  (function () {
    var imgs = Array.prototype.slice.call(document.images);
    var left = imgs.length;
    function done() { if (--left <= 0) setTimeout(function () { window.print(); }, 150); }
    if (!left) { window.print(); return; }
    imgs.forEach(function (img) {
      if (img.complete) done();
      else { img.addEventListener("load", done); img.addEventListener("error", done); }
    });
  })();
</script>
</body>
</html>`;
}

/**
 * Open the deck in a new tab. The document is handed over as a generated
 * file (a blob URL) rather than written into the window, and every value in
 * it is escaped above. False when the browser blocked the new tab.
 */
export function openDeck(html: string): boolean {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const win = window.open(url, "_blank");
  // Give the tab time to load the file before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return Boolean(win);
}
