import {
  deckColumns,
  deckPages,
  photoCaption,
  storeLabel,
  summarizeDeckSelection,
  type DeckLayout,
  type DeckTheme,
  type GalleryPhoto,
} from "./photoGallery";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );

export interface BuildDeckOptions {
  title: string;
  subtitle: string;
  photos: readonly GalleryPhoto[];
  perPage: DeckLayout;
  theme?: DeckTheme;
  includeCover?: boolean;
  brandName?: string;
}

/**
 * Editorial, print-ready landscape Letter HTML lookbook (11in × 8.5in).
 *
 * Supports warm editorial paper (`#FAF9F5`) or dark gallery (`#0E100C`), an
 * optional Executive Cover Slide with retail door/state reach + hero lead
 * photo, concentric framed photo grids, and a non-printing screen bar so
 * buyers or founders can preview or re-save to PDF anytime.
 */
export function buildDeckHtml(opts: BuildDeckOptions): string {
  const theme: DeckTheme = opts.theme ?? "paper";
  const includeCover = Boolean(opts.includeCover && opts.photos.length > 0);
  const cols = deckColumns(opts.perPage);
  const rows = Math.ceil(opts.perPage / cols);
  const pages = deckPages(opts.photos, opts.perPage);
  const summary = summarizeDeckSelection(opts.photos, opts.perPage, includeCover);
  const totalSlides = summary.slideCount;
  const brandEyebrow = (opts.brandName || "").trim() || "FIELD EXECUTION LOOKBOOK";
  const subtitleLine = [opts.subtitle, summary.dateWindowLabel]
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(" · ");

  const palette =
    theme === "dark"
      ? {
          screenBg: "#070806",
          pageBg: "#0E100C",
          frameBg: "#171A14",
          ink: "#F2F3EE",
          muted: "rgba(242, 243, 238, 0.68)",
          meta: "rgba(242, 243, 238, 0.48)",
          rule: "rgba(242, 243, 238, 0.14)",
          frameBorder: "rgba(242, 243, 238, 0.12)",
          accent: "#D9F154",
          accentInk: "#0E100C",
          statBg: "rgba(242, 243, 238, 0.04)",
        }
      : {
          screenBg: "#E6E6DF",
          pageBg: "#FAF9F5",
          frameBg: "#EFEFE9",
          ink: "#14160F",
          muted: "#4F5447",
          meta: "#767B6C",
          rule: "#DCDDD4",
          frameBorder: "rgba(20, 22, 15, 0.1)",
          accent: "#14160F",
          accentInk: "#FAF9F5",
          statBg: "#F2F1EB",
        };

  const hero = opts.photos[0];
  const coverHtml =
    includeCover && hero
      ? `
<section class="page cover-page">
  <div class="cover-grid">
    <div class="cover-copy">
      <div>
        <span class="eyebrow-pill">${esc(brandEyebrow)}</span>
        <h1 class="cover-title">${esc(opts.title)}</h1>
        ${
          subtitleLine
            ? `<p class="cover-subtitle">${esc(subtitleLine)}</p>`
            : ""
        }
      </div>
      <div class="cover-stats">
        <div class="stat-box">
          <span class="stat-label">CURATED PHOTOS</span>
          <strong class="stat-value">${summary.photoCount.toLocaleString("en-US")}</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">RETAIL DOORS</span>
          <strong class="stat-value">${Math.max(1, summary.uniqueStores).toLocaleString("en-US")}</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">MARKETS / STATES</span>
          <strong class="stat-value">${Math.max(1, summary.uniqueStates).toLocaleString("en-US")}</strong>
        </div>
      </div>
      <div class="cover-foot">
        <span>Verified field proof · Spark by Ignite Productions</span>
        <span class="mono-num">01 / ${String(totalSlides).padStart(2, "0")}</span>
      </div>
    </div>
    <div class="cover-hero">
      <div class="cover-hero-frame">
        <img src="${esc(hero.url)}" alt="${esc(hero.caption || hero.category || "Lead field photo")}" />
      </div>
      <p class="cover-hero-caption">
        <b>${esc(hero.category || "Lead activation")}</b>
        ${photoCaption(hero) ? `<span> · ${esc(photoCaption(hero))}</span>` : ""}
      </p>
    </div>
  </div>
</section>`
      : "";

  const contentHtml = pages
    .map((page, i) => {
      const slideNum = i + 1 + (includeCover ? 1 : 0);
      return `
<section class="page">
  <header class="slide-head">
    <div class="slide-head-left">
      <span class="slide-eyebrow">${esc(brandEyebrow)}</span>
      <strong>${esc(opts.title)}</strong>
    </div>
    <span class="slide-sub">${esc(subtitleLine)}</span>
  </header>
  <div class="grid">
    ${page
      .map((p) => {
        const loc = photoCaption(p);
        const note = (p.caption || "").trim();
        const store = storeLabel(p.store);
        return `<figure>
      <div class="frame">
        <img src="${esc(p.url)}" alt="${esc(note || p.category || store || "Field photo")}" />
      </div>
      <figcaption>
        <div class="cap-top">
          <b>${esc(p.category || "Field photo")}</b>
          ${loc ? `<span class="cap-loc">${esc(loc)}</span>` : ""}
        </div>
        ${note ? `<p class="cap-note">${esc(note)}</p>` : ""}
      </figcaption>
    </figure>`;
      })
      .join("\n")}
  </div>
  <footer class="slide-foot">
    <span>Ignite Productions · Verified Field Proof</span>
    <span class="mono-num">${String(slideNum).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}</span>
  </footer>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(opts.title)} — photo deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: 11in 8.5in; margin: 0.4in; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    margin: 0;
    background: ${palette.pageBg};
    color: ${palette.ink};
    font-family: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  }
  .mono-num {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
  }
  .screen-bar {
    display: none;
  }
  .page {
    height: 7.7in;
    background: ${palette.pageBg};
    color: ${palette.ink};
    display: flex;
    flex-direction: column;
    gap: 0.14in;
    break-after: page;
    page-break-after: always;
  }
  .page:last-of-type { break-after: auto; page-break-after: auto; }

  /* Cover slide */
  .cover-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1.12fr 0.88fr;
    gap: 0.32in;
    align-items: stretch;
  }
  .cover-copy {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.12in 0;
  }
  .eyebrow-pill {
    display: inline-block;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 999px;
    background: ${palette.accent};
    color: ${palette.accentInk};
    margin-bottom: 0.18in;
  }
  .cover-title {
    margin: 0;
    font-size: 34pt;
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.04;
  }
  .cover-subtitle {
    margin: 0.14in 0 0;
    font-size: 11.5pt;
    color: ${palette.muted};
    line-height: 1.4;
  }
  .cover-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.12in;
    margin: 0.2in 0;
  }
  .stat-box {
    background: ${palette.statBg};
    border: 1px solid ${palette.frameBorder};
    border-radius: 10px;
    padding: 0.14in 0.16in;
  }
  .stat-label {
    display: block;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 6.5pt;
    letter-spacing: 0.14em;
    color: ${palette.meta};
    margin-bottom: 4px;
  }
  .stat-value {
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  .cover-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.12in;
    border-top: 1px solid ${palette.rule};
    font-size: 8pt;
    color: ${palette.meta};
  }
  .cover-hero {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.08in;
  }
  .cover-hero-frame {
    flex: 1;
    min-height: 0;
    background: ${palette.frameBg};
    border: 1px solid ${palette.frameBorder};
    border-radius: 14px;
    overflow: hidden;
  }
  .cover-hero-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cover-hero-caption {
    margin: 0;
    font-size: 8pt;
    color: ${palette.muted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cover-hero-caption b {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 7pt;
    color: ${palette.ink};
  }

  /* Content slides */
  .slide-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.2in;
    border-bottom: 1px solid ${palette.rule};
    padding-bottom: 0.08in;
  }
  .slide-head-left {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  .slide-eyebrow {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 6.5pt;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${palette.meta};
  }
  .slide-head strong {
    font-size: 13.5pt;
    letter-spacing: -0.025em;
  }
  .slide-sub {
    font-size: 8.5pt;
    color: ${palette.muted};
    white-space: nowrap;
  }
  .grid {
    flex: 1;
    min-height: 0;
    display: grid;
    gap: 0.14in;
    grid-template-columns: repeat(${cols}, 1fr);
    grid-template-rows: repeat(${rows}, 1fr);
  }
  figure {
    margin: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.05in;
  }
  .frame {
    flex: 1;
    min-height: 0;
    background: ${palette.frameBg};
    border: 1px solid ${palette.frameBorder};
    border-radius: 9px;
    overflow: hidden;
  }
  .frame img {
    width: 100%;
    height: 100%;
    object-fit: ${opts.perPage === 1 ? "contain" : "cover"};
    display: block;
  }
  figcaption {
    font-size: 8pt;
    line-height: 1.25;
  }
  .cap-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  figcaption b {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 6.8pt;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cap-loc {
    color: ${palette.muted};
    font-size: 7.5pt;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cap-note {
    margin: 2px 0 0;
    font-size: 7.4pt;
    color: ${palette.meta};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .slide-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7.5pt;
    color: ${palette.meta};
    padding-top: 0.04in;
    border-top: 1px solid ${palette.rule};
  }

  @media screen {
    body {
      background: ${palette.screenBg};
      padding: 56px 20px 28px;
    }
    .screen-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 44px;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      background: rgba(20, 22, 15, 0.92);
      color: #F2F3EE;
      font-size: 12px;
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }
    .screen-bar button {
      background: #D9F154;
      color: #14160F;
      border: 0;
      border-radius: 8px;
      padding: 6px 12px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .page {
      width: 10.2in;
      margin: 0 auto 20px;
      padding: 0.34in;
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
    }
  }
  @media print {
    .screen-bar { display: none !important; }
  }
</style>
</head>
<body>
<div class="screen-bar">
  <span><strong>${esc(opts.title)}</strong> · ${summary.photoCount} photo${summary.photoCount === 1 ? "" : "s"} · ${totalSlides} landscape slide${totalSlides === 1 ? "" : "s"}</span>
  <button type="button" onclick="window.print()">Print / Save as PDF</button>
</div>
${coverHtml}
${contentHtml}
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
