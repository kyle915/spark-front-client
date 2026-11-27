/**
 * Native 16:9 PowerPoint (.pptx) exporter for Retail Buyer QBR / Line-Review Decks.
 *
 * Uses `jszip` to emit a clean, standards-compliant OOXML package
 * (13.333" x 7.5" widescreen) that opens natively without repair prompts in
 * Microsoft PowerPoint, Apple Keynote, and Google Slides.
 *
 * Every slide uses editable OOXML text boxes, KPI cards, and native tables,
 * enriched with high-DPI PNG renders of the US footprint choropleth map,
 * 2–4 week POS lift halo chart, and curated in-store shelf/demo photos.
 */

import JSZip from "jszip";
import { buildFootprintSvgMarkup } from "./pitchFootprintGeometry";
import {
  buildPitchSlidePlan,
  fmtPitchNum,
  fmtPitchPct,
  resolveDeckAccentHex,
  sanitizeDeckFilename,
  type PitchPayload,
  type PitchPhoto,
  type PitchSlideDescriptor,
} from "./pitchDeckTypes";

const SLIDE_W = 12_192_000; // 13.333 in in EMU (1 in = 914,400 EMU)
const SLIDE_H = 6_858_000; // 7.5 in in EMU
const IN = 914_400;

const GROUND_HEX = "F6F6F2";
const CARD_HEX = "FFFFFF";
const BORDER_HEX = "DCDDD5";
const INK_HEX = "14160F";
const MUTED_HEX = "5C6154";
const SOFT_BG_HEX = "F1F2EC";
const OK_HEX = "2B4C08";
const OK_BG_HEX = "EBF3E1";
const WARN_HEX = "A8340F";

type EmbeddedImage = {
  rId: string;
  target: string; // e.g. ../media/image1.png
  ext: "png" | "jpeg";
  data: Uint8Array;
};

type SlideBuildContext = {
  mediaCounter: number;
  mediaFiles: Array<{ path: string; ext: "png" | "jpeg"; data: Uint8Array }>;
  accentHexNoHash: string;
};

function emu(inches: number): number {
  return Math.round(inches * IN);
}

function xmlEsc(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clip(raw: unknown, max: number): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function rectShape(opts: {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  border?: string;
  borderPt?: number;
  rounded?: boolean;
}): string {
  const prst = opts.rounded ? "roundRect" : "rect";
  const avLst = opts.rounded
    ? `<a:avLst><a:gd name="adj" fmla="val 6500"/></a:avLst>`
    : "<a:avLst/>";
  const fillXml = opts.fill
    ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>`
    : "<a:noFill/>";
  const lnXml = opts.border
    ? `<a:ln w="${Math.round((opts.borderPt ?? 0.75) * 12700)}"><a:solidFill><a:srgbClr val="${opts.border}"/></a:solidFill></a:ln>`
    : "<a:ln><a:noFill/></a:ln>";
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${opts.id}" name="${xmlEsc(opts.name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${emu(opts.x)}" y="${emu(opts.y)}"/><a:ext cx="${emu(opts.w)}" cy="${emu(opts.h)}"/></a:xfrm>
    <a:prstGeom prst="${prst}">${avLst}</a:prstGeom>
    ${fillXml}
    ${lnXml}
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`;
}

function textBox(opts: {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  align?: "l" | "ctr" | "r";
  fontFace?: string;
  valign?: "t" | "ctr" | "b";
}): string {
  const sz = Math.round((opts.fontSize ?? 12) * 100);
  const color = opts.color ?? INK_HEX;
  const align = opts.align ?? "l";
  const anchor = opts.valign ?? "t";
  const face = opts.fontFace ?? "Helvetica Neue";
  const lines = String(opts.text ?? "").split("\n");
  const paragraphs = lines
    .map(
      (line) => `<a:p>
      <a:pPr algn="${align}"/>
      <a:r>
        <a:rPr lang="en-US" sz="${sz}" b="${opts.bold ? 1 : 0}" dirty="0">
          <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          <a:latin typeface="${xmlEsc(face)}"/>
        </a:rPr>
        <a:t>${xmlEsc(line)}</a:t>
      </a:r>
    </a:p>`,
    )
    .join("");
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${opts.id}" name="${xmlEsc(opts.name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${emu(opts.x)}" y="${emu(opts.y)}"/><a:ext cx="${emu(opts.w)}" cy="${emu(opts.h)}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="36000" tIns="18000" rIns="36000" bIns="18000" anchor="${anchor}"/>
    <a:lstStyle/>
    ${paragraphs}
  </p:txBody>
</p:sp>`;
}

function picShape(opts: {
  id: number;
  name: string;
  rId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}): string {
  return `<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="${opts.id}" name="${xmlEsc(opts.name)}"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${opts.rId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="${emu(opts.x)}" y="${emu(opts.y)}"/><a:ext cx="${emu(opts.w)}" cy="${emu(opts.h)}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>`;
}

function tableShape(opts: {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  colWidths: number[];
  headers: string[];
  rows: string[][];
  alignRightCols?: Set<number>;
}): string {
  const rowH = Math.min(
    emu(0.42),
    Math.max(emu(0.28), Math.floor(emu(opts.h) / Math.max(2, opts.rows.length + 1))),
  );
  const gridCols = opts.colWidths
    .map((cw) => `<a:gridCol w="${emu(cw)}"/>`)
    .join("");

  const renderCell = (
    text: string,
    isHeader: boolean,
    alignRight: boolean,
    rowIdx: number,
  ) => {
    const fill = isHeader
      ? SOFT_BG_HEX
      : rowIdx % 2 === 1
        ? "FAFAF7"
        : CARD_HEX;
    const fg = isHeader ? MUTED_HEX : INK_HEX;
    const sz = isHeader ? 900 : 1000;
    return `<a:tc>
      <a:txBody>
        <a:bodyPr lIns="64000" rIns="64000" tIns="36000" bIns="36000" anchor="ctr"/>
        <a:lstStyle/>
        <a:p>
          <a:pPr algn="${alignRight ? "r" : "l"}"/>
          <a:r>
            <a:rPr lang="en-US" sz="${sz}" b="${isHeader ? 1 : 0}" dirty="0">
              <a:solidFill><a:srgbClr val="${fg}"/></a:solidFill>
              <a:latin typeface="Helvetica Neue"/>
            </a:rPr>
            <a:t>${xmlEsc(text)}</a:t>
          </a:r>
        </a:p>
      </a:txBody>
      <a:tcPr marL="64000" marR="64000" marT="36000" marB="36000" anchor="ctr">
        <a:lnL w="0"><a:noFill/></a:lnL>
        <a:lnR w="0"><a:noFill/></a:lnR>
        <a:lnT w="6350"><a:solidFill><a:srgbClr val="${BORDER_HEX}"/></a:solidFill></a:lnT>
        <a:lnB w="6350"><a:solidFill><a:srgbClr val="${BORDER_HEX}"/></a:solidFill></a:lnB>
        <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
      </a:tcPr>
    </a:tc>`;
  };

  const headerTr = `<a:tr h="${emu(0.34)}">${opts.headers
    .map((h, ci) => renderCell(h, true, Boolean(opts.alignRightCols?.has(ci)), 0))
    .join("")}</a:tr>`;

  const bodyTrs = opts.rows
    .map(
      (r, ri) =>
        `<a:tr h="${rowH}">${r
          .map((cell, ci) =>
            renderCell(cell, false, Boolean(opts.alignRightCols?.has(ci)), ri),
          )
          .join("")}</a:tr>`,
    )
    .join("");

  return `<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:cNvPr id="${opts.id}" name="${xmlEsc(opts.name)}"/>
    <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
    <p:nvPr/>
  </p:nvGraphicFramePr>
  <p:xfrm><a:off x="${emu(opts.x)}" y="${emu(opts.y)}"/><a:ext cx="${emu(opts.w)}" cy="${emu(opts.h)}"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblPr firstRow="1" bandRow="1"/>
        <a:tblGrid>${gridCols}</a:tblGrid>
        ${headerTr}
        ${bodyTrs}
      </a:tbl>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;
}

function slideEnvelope(shapesXml: string, bgHex = GROUND_HEX): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bgHex}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapesXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function slideRelsXml(images: EmbeddedImage[]): string {
  const picRels = images
    .map(
      (img) =>
        `<Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${img.target}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  ${picRels}
</Relationships>`;
}

function registerMedia(
  ctx: SlideBuildContext,
  slideImages: EmbeddedImage[],
  data: Uint8Array,
  ext: "png" | "jpeg",
): string {
  ctx.mediaCounter += 1;
  const filename = `image${ctx.mediaCounter}.${ext}`;
  const rId = `rId${slideImages.length + 2}`;
  ctx.mediaFiles.push({ path: `ppt/media/${filename}`, ext, data });
  slideImages.push({ rId, target: `../media/${filename}`, ext, data });
  return rId;
}

function chromeHeaderFooter(opts: {
  nextId: () => number;
  eyebrow: string;
  title: string;
  subtitle?: string;
  brandName: string;
  period: string;
  slideNum: number;
  totalSlides: number;
  accentHex: string;
}): string {
  const parts: string[] = [
    rectShape({
      id: opts.nextId(),
      name: "TopAccent",
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.08,
      fill: opts.accentHex,
    }),
    textBox({
      id: opts.nextId(),
      name: "Eyebrow",
      x: 0.65,
      y: 0.34,
      w: 9.5,
      h: 0.28,
      text: opts.eyebrow.toUpperCase(),
      fontSize: 9.5,
      bold: true,
      color: MUTED_HEX,
    }),
    textBox({
      id: opts.nextId(),
      name: "Title",
      x: 0.65,
      y: 0.62,
      w: 11.8,
      h: 0.55,
      text: opts.title,
      fontSize: 24,
      bold: true,
      color: INK_HEX,
    }),
  ];
  if (opts.subtitle) {
    parts.push(
      textBox({
        id: opts.nextId(),
        name: "Subtitle",
        x: 0.65,
        y: 1.15,
        w: 11.8,
        h: 0.32,
        text: opts.subtitle,
        fontSize: 11.5,
        color: MUTED_HEX,
      }),
    );
  }
  parts.push(
    rectShape({
      id: opts.nextId(),
      name: "FooterRule",
      x: 0.65,
      y: 6.95,
      w: 12.033,
      h: 0.012,
      fill: BORDER_HEX,
    }),
    textBox({
      id: opts.nextId(),
      name: "FooterLeft",
      x: 0.65,
      y: 7.03,
      w: 8.5,
      h: 0.3,
      text: `${opts.brandName} · Retail Buyer QBR · ${opts.period} · Prepared with Spark`,
      fontSize: 9,
      color: MUTED_HEX,
    }),
    textBox({
      id: opts.nextId(),
      name: "FooterRight",
      x: 10.5,
      y: 7.03,
      w: 2.18,
      h: 0.3,
      text: `${opts.slideNum} / ${opts.totalSlides}`,
      fontSize: 9,
      bold: true,
      color: MUTED_HEX,
      align: "r",
    }),
  );
  return parts.join("\n");
}

async function svgToPngBytes(
  svgMarkup: string,
  width: number,
  height: number,
): Promise<Uint8Array | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return null;
  }
  try {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!pngBlob) return null;
      return new Uint8Array(await pngBlob.arrayBuffer());
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

async function renderBarChartPng(opts: {
  bars: Array<{ label: string; value: number; badge?: string; highlight?: boolean }>;
  accentHex: string;
  yLabel: string;
}): Promise<Uint8Array | null> {
  if (typeof document === "undefined" || opts.bars.length === 0) return null;
  try {
    const W = 1280;
    const H = 640;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    const padL = 90;
    const padR = 50;
    const padT = 70;
    const padB = 110;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const maxV = Math.max(1, ...opts.bars.map((b) => b.value)) * 1.18;

    // Subtle gridlines
    ctx.strokeStyle = "#E8EAE1";
    ctx.lineWidth = 1.5;
    ctx.font = "500 20px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = "#5C6154";
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      const val = Math.round(maxV * (1 - i / 4));
      ctx.textAlign = "right";
      ctx.fillText(val.toLocaleString(), padL - 14, y + 7);
    }

    // Y label
    ctx.save();
    ctx.textAlign = "left";
    ctx.font = "600 20px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = "#5C6154";
    ctx.fillText(opts.yLabel, padL, 38);
    ctx.restore();

    const step = plotW / opts.bars.length;
    const barW = Math.min(120, step * 0.56);

    opts.bars.forEach((b, idx) => {
      const cx = padL + step * idx + step / 2;
      const h = Math.max(4, (b.value / maxV) * plotH);
      const x = cx - barW / 2;
      const y = padT + plotH - h;

      ctx.fillStyle = b.highlight ? `#${opts.accentHex}` : "#C8CCBE";
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, [10, 10, 0, 0]);
      ctx.fill();

      // Value above bar
      ctx.fillStyle = "#14160F";
      ctx.textAlign = "center";
      ctx.font = "700 24px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillText(b.value.toLocaleString(), cx, y - 14);

      if (b.badge) {
        ctx.fillStyle = b.badge.startsWith("+") ? "#2B4C08" : "#5C6154";
        ctx.font = "600 18px 'Helvetica Neue', Arial, sans-serif";
        ctx.fillText(b.badge, cx, y - 40);
      }

      // X label
      ctx.fillStyle = "#14160F";
      ctx.font = "600 20px 'Helvetica Neue', Arial, sans-serif";
      const lbl = clip(b.label, 18);
      ctx.fillText(lbl, cx, padT + plotH + 38);
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

async function fetchImageForSlide(
  url: string,
): Promise<{ data: Uint8Array; ext: "png" | "jpeg" } | null> {
  if (typeof fetch === "undefined" || !url) return null;
  try {
    const controller = new AbortController();
    const timer =
      typeof window !== "undefined"
        ? window.setTimeout(() => controller.abort(), 7000)
        : null;
    try {
      const res = await fetch(url, { mode: "cors", signal: controller.signal });
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 12) return null;
      // Check PNG magic bytes
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return { data: buf, ext: "png" };
      }
      // Check JPEG magic bytes
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { data: buf, ext: "jpeg" };
      }
      // WebP or other browser-decodable format → transcode via canvas to JPEG
      if (typeof document !== "undefined" && typeof createImageBitmap !== "undefined") {
        const bmp = await createImageBitmap(new Blob([buf]));
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1200, bmp.width);
        canvas.height = Math.round((canvas.width / bmp.width) * bmp.height);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          const jpgBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.86),
          );
          if (jpgBlob) {
            return {
              data: new Uint8Array(await jpgBlob.arrayBuffer()),
              ext: "jpeg",
            };
          }
        }
      }
      return null;
    } finally {
      if (timer != null && typeof window !== "undefined") {
        window.clearTimeout(timer);
      }
    }
  } catch {
    return null;
  }
}

async function buildSlideXml(
  descriptor: PitchSlideDescriptor,
  data: PitchPayload,
  slideNum: number,
  totalSlides: number,
  ctx: SlideBuildContext,
  fetchPhotos: boolean,
): Promise<{ xml: string; images: EmbeddedImage[] }> {
  let idSeq = 2;
  const nextId = () => idSeq++;
  const slideImages: EmbeddedImage[] = [];
  const brandName = data.brandName || data.brand?.name || "Brand";
  const period =
    data.periodStart && data.periodEnd
      ? `${data.periodStart} → ${data.periodEnd}`
      : "Program window";
  const scopeBits = [
    data.retailerFilter ? data.retailerFilter : null,
    data.marketFilter ? data.marketFilter : null,
  ].filter(Boolean);
  const kpis = data.kpis || {};
  const accent = ctx.accentHexNoHash;

  if (descriptor.id === "cover") {
    const sellStory = clip(data.sellStory || data.introNote || "", 340);
    const statCards = [
      { label: "VISITS", value: fmtPitchNum(kpis.totalVisits) },
      { label: "STORES ACTIVATED", value: fmtPitchNum(kpis.storesActivated) },
      {
        label: "SAMPLES HANDED OUT",
        value: fmtPitchNum(kpis.totalSamplesDistributed),
      },
      kpis.samplingLiftPct != null
        ? {
            label: "MATCHED POS LIFT",
            value: fmtPitchPct(kpis.samplingLiftPct, true),
          }
        : {
            label: "REP-OBSERVED UNITS",
            value: fmtPitchNum(kpis.repObservedUnits),
          },
    ];
    const parts: string[] = [
      rectShape({
        id: nextId(),
        name: "CoverAccent",
        x: 0,
        y: 0,
        w: 13.333,
        h: 0.14,
        fill: accent,
      }),
      textBox({
        id: nextId(),
        name: "CoverEyebrow",
        x: 0.85,
        y: 0.85,
        w: 11.6,
        h: 0.35,
        text: `${brandName.toUpperCase()} · RETAIL BUYER QBR & LINE-REVIEW DECK${
          data.buyerName ? ` · PREPARED FOR ${data.buyerName.toUpperCase()}` : ""
        }`,
        fontSize: 10.5,
        bold: true,
        color: MUTED_HEX,
      }),
      textBox({
        id: nextId(),
        name: "CoverTitle",
        x: 0.85,
        y: 1.35,
        w: 11.6,
        h: 1.25,
        text: clip(data.title || `${brandName} Buyer Pitch Deck`, 90),
        fontSize: 38,
        bold: true,
        color: INK_HEX,
      }),
      textBox({
        id: nextId(),
        name: "CoverMeta",
        x: 0.85,
        y: 2.6,
        w: 11.6,
        h: 0.45,
        text: [data.subtitle, period, ...scopeBits].filter(Boolean).join("  ·  "),
        fontSize: 13.5,
        color: MUTED_HEX,
      }),
    ];

    if (sellStory) {
      parts.push(
        rectShape({
          id: nextId(),
          name: "ThesisCard",
          x: 0.85,
          y: 3.3,
          w: 11.63,
          h: 1.35,
          fill: CARD_HEX,
          border: BORDER_HEX,
          rounded: true,
        }),
        rectShape({
          id: nextId(),
          name: "ThesisBar",
          x: 0.85,
          y: 3.3,
          w: 0.08,
          h: 1.35,
          fill: accent,
        }),
        textBox({
          id: nextId(),
          name: "ThesisText",
          x: 1.15,
          y: 3.45,
          w: 11.1,
          h: 1.05,
          text: sellStory,
          fontSize: 13.5,
          color: INK_HEX,
          valign: "ctr",
        }),
      );
    }

    const cardW = 2.75;
    const gap = 0.21;
    statCards.forEach((sc, idx) => {
      const cx = 0.85 + idx * (cardW + gap);
      const cy = 5.05;
      parts.push(
        rectShape({
          id: nextId(),
          name: `CoverStatBg${idx}`,
          x: cx,
          y: cy,
          w: cardW,
          h: 1.45,
          fill: CARD_HEX,
          border: BORDER_HEX,
          rounded: true,
        }),
        textBox({
          id: nextId(),
          name: `CoverStatLbl${idx}`,
          x: cx + 0.18,
          y: cy + 0.2,
          w: cardW - 0.36,
          h: 0.3,
          text: sc.label,
          fontSize: 9,
          bold: true,
          color: MUTED_HEX,
        }),
        textBox({
          id: nextId(),
          name: `CoverStatVal${idx}`,
          x: cx + 0.18,
          y: cy + 0.55,
          w: cardW - 0.36,
          h: 0.7,
          text: sc.value,
          fontSize: 28,
          bold: true,
          color: idx === 3 && kpis.samplingLiftPct != null ? OK_HEX : INK_HEX,
        }),
      );
    });

    parts.push(
      textBox({
        id: nextId(),
        name: "CoverFooter",
        x: 0.85,
        y: 6.98,
        w: 11.63,
        h: 0.32,
        text: `Prepared with Spark · Verified in-store execution, shelf compliance, and retail lift`,
        fontSize: 9.5,
        color: MUTED_HEX,
      }),
    );
    return { xml: slideEnvelope(parts.join("\n")), images: slideImages };
  }

  const parts: string[] = [
    chromeHeaderFooter({
      nextId,
      eyebrow: `${brandName} · ${descriptor.label}`,
      title: descriptor.title,
      subtitle: scopeBits.length > 0 ? `${period} · ${scopeBits.join(" · ")}` : period,
      brandName,
      period,
      slideNum,
      totalSlides,
      accentHex: accent,
    }),
  ];

  if (descriptor.id === "kpis") {
    const cards: Array<{ label: string; value: string }> = [
      { label: "VISITS", value: fmtPitchNum(kpis.totalVisits) },
      { label: "STORES ACTIVATED", value: fmtPitchNum(kpis.storesActivated) },
      { label: "SAMPLES HANDED OUT", value: fmtPitchNum(kpis.totalSamplesDistributed) },
      { label: "REP-OBSERVED UNITS", value: fmtPitchNum(kpis.repObservedUnits) },
      { label: "ADJUSTED REGISTER UNITS", value: fmtPitchNum(kpis.adjustedRegisterUnits) },
      { label: "SAMPLING LIFT", value: fmtPitchPct(kpis.samplingLiftPct, true) },
    ];
    if (data.includeCosts) {
      cards.push(
        {
          label: "SUPPORTED SPEND",
          value: kpis.totalSupportedCost != null ? `$${fmtPitchNum(kpis.totalSupportedCost)}` : "—",
        },
        {
          label: "COST / UNIT SOLD",
          value: kpis.costPerUnitSold != null ? `$${fmtPitchNum(kpis.costPerUnitSold)}` : "—",
        },
      );
    }

    const cols = cards.length > 6 ? 4 : 3;
    const cw = (12.03 - (cols - 1) * 0.2) / cols;
    cards.forEach((c, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 0.65 + col * (cw + 0.2);
      const y = 1.62 + row * 1.15;
      parts.push(
        rectShape({
          id: nextId(),
          name: `KpiBg${idx}`,
          x,
          y,
          w: cw,
          h: 1.0,
          fill: CARD_HEX,
          border: BORDER_HEX,
          rounded: true,
        }),
        textBox({
          id: nextId(),
          name: `KpiLbl${idx}`,
          x: x + 0.16,
          y: y + 0.14,
          w: cw - 0.32,
          h: 0.25,
          text: c.label,
          fontSize: 8.5,
          bold: true,
          color: MUTED_HEX,
        }),
        textBox({
          id: nextId(),
          name: `KpiVal${idx}`,
          x: x + 0.16,
          y: y + 0.42,
          w: cw - 0.32,
          h: 0.46,
          text: c.value,
          fontSize: 21,
          bold: true,
          color: INK_HEX,
        }),
      );
    });

    const retailers = (data.retailerBreakdown || []).slice(0, 6);
    if (retailers.length > 0) {
      const headers = data.includeCosts
        ? ["Retailer Banner", "Doors", "Visits", "Samples", "Rep Units", "Register POS", "Cost / Unit"]
        : ["Retailer Banner", "Doors", "Visits", "Samples", "Rep Units", "Register POS"];
      const colWidths = data.includeCosts
        ? [3.53, 1.1, 1.1, 1.55, 1.55, 1.6, 1.6]
        : [4.33, 1.25, 1.25, 1.7, 1.7, 1.8];
      const rows = retailers.map((r) => {
        const base = [
          clip(r.retailerBanner || "Retailer", 36),
          fmtPitchNum(r.storesCount),
          fmtPitchNum(r.visits),
          fmtPitchNum(r.samplesDistributed),
          fmtPitchNum(r.repObservedUnits),
          r.adjustedRegisterUnits != null ? fmtPitchNum(r.adjustedRegisterUnits) : "—",
        ];
        if (data.includeCosts) {
          base.push(r.costPerUnitSold != null ? `$${r.costPerUnitSold}` : "—");
        }
        return base;
      });
      parts.push(
        tableShape({
          id: nextId(),
          name: "RetailerBreakdownTable",
          x: 0.65,
          y: 4.15,
          w: 12.03,
          h: 2.55,
          colWidths,
          headers,
          rows,
          alignRightCols: new Set([1, 2, 3, 4, 5, 6]),
        }),
      );
    }
  } else if (descriptor.id === "footprint") {
    const fp = data.footprint!;
    const mapSvg = buildFootprintSvgMarkup(fp.states || [], `#${accent}`);
    const mapPng = await svgToPngBytes(mapSvg, 1200, 735);
    if (mapPng) {
      const rId = registerMedia(ctx, slideImages, mapPng, "png");
      parts.push(
        rectShape({
          id: nextId(),
          name: "MapCardBg",
          x: 0.65,
          y: 1.65,
          w: 7.2,
          h: 5.0,
          fill: CARD_HEX,
          border: BORDER_HEX,
          rounded: true,
        }),
        picShape({
          id: nextId(),
          name: "FootprintMap",
          rId,
          x: 0.8,
          y: 1.9,
          w: 6.9,
          h: 4.22,
        }),
        textBox({
          id: nextId(),
          name: "MapCaption",
          x: 0.85,
          y: 6.22,
          w: 6.8,
          h: 0.3,
          text: `${fp.statesCount} ${fp.statesCount === 1 ? "state" : "states"} · ${fp.marketsCount} ${fp.marketsCount === 1 ? "market" : "markets"} activated`,
          fontSize: 10,
          bold: true,
          color: MUTED_HEX,
        }),
      );
    }

    const tableX = mapPng ? 8.05 : 0.65;
    const tableW = mapPng ? 4.63 : 12.03;
    const statesSlice = (fp.states || []).slice(0, 10);
    const rows = statesSlice.map((s) => [
      s.state,
      fmtPitchNum(s.stores),
      fmtPitchNum(s.visits),
      fmtPitchNum(s.samples),
      fmtPitchNum(s.repUnits),
    ]);
    parts.push(
      tableShape({
        id: nextId(),
        name: "StateFootprintTable",
        x: tableX,
        y: 1.65,
        w: tableW,
        h: 5.0,
        colWidths: mapPng
          ? [0.85, 0.83, 0.85, 1.05, 1.05]
          : [2.43, 2.2, 2.2, 2.6, 2.6],
        headers: ["State", "Doors", "Visits", "Samples", "Rep Units"],
        rows,
        alignRightCols: new Set([1, 2, 3, 4]),
      }),
    );
  } else if (descriptor.id === "halo") {
    const halo = data.posHalo;
    if (halo?.available && halo.weeks.length > 0) {
      const summaryCards = [
        {
          label: "PRE-DEMO BASELINE",
          value:
            halo.baselineAvgUnits != null
              ? `${halo.baselineAvgUnits} u/wk`
              : "—",
        },
        {
          label: "DEMO WEEK LIFT",
          value: fmtPitchPct(halo.demoWeekLiftPct, true),
        },
        {
          label: "2–4 WK POST-DEMO HALO",
          value: fmtPitchPct(halo.postDemoHaloPct, true),
        },
        {
          label: "MATCHED POS DOORS",
          value: fmtPitchNum(halo.matchedStores),
        },
      ];
      summaryCards.forEach((sc, idx) => {
        const x = 0.65 + idx * 3.05;
        parts.push(
          rectShape({
            id: nextId(),
            name: `HaloCard${idx}`,
            x,
            y: 1.62,
            w: 2.88,
            h: 1.05,
            fill: CARD_HEX,
            border: BORDER_HEX,
            rounded: true,
          }),
          textBox({
            id: nextId(),
            name: `HaloLbl${idx}`,
            x: x + 0.16,
            y: 1.75,
            w: 2.56,
            h: 0.25,
            text: sc.label,
            fontSize: 8.5,
            bold: true,
            color: MUTED_HEX,
          }),
          textBox({
            id: nextId(),
            name: `HaloVal${idx}`,
            x: x + 0.16,
            y: 2.04,
            w: 2.56,
            h: 0.5,
            text: sc.value,
            fontSize: 22,
            bold: true,
            color: idx === 1 || idx === 2 ? OK_HEX : INK_HEX,
          }),
        );
      });

      const chartPng = await renderBarChartPng({
        bars: halo.weeks.map((w) => ({
          label: w.label,
          value: w.avgUnits,
          badge: w.offset >= 0 && w.liftPct != null ? fmtPitchPct(w.liftPct, true) : undefined,
          highlight: w.offset >= 0,
        })),
        accentHex: accent,
        yLabel: "Avg matched POS units / store-SKU-week",
      });
      if (chartPng) {
        const rId = registerMedia(ctx, slideImages, chartPng, "png");
        parts.push(
          rectShape({
            id: nextId(),
            name: "HaloChartCard",
            x: 0.65,
            y: 2.88,
            w: 12.03,
            h: 3.82,
            fill: CARD_HEX,
            border: BORDER_HEX,
            rounded: true,
          }),
          picShape({
            id: nextId(),
            name: "HaloChartPng",
            rId,
            x: 0.9,
            y: 3.0,
            w: 11.5,
            h: 3.55,
          }),
        );
      } else {
        parts.push(
          tableShape({
            id: nextId(),
            name: "HaloFallbackTable",
            x: 0.65,
            y: 2.9,
            w: 12.03,
            h: 3.6,
            colWidths: [3.63, 2.2, 2.2, 2.0, 2.0],
            headers: ["Window", "Avg Units / Store-Wk", "Total Units", "Store-Weeks", "Lift vs Baseline"],
            rows: halo.weeks.map((w) => [
              w.label,
              String(w.avgUnits),
              fmtPitchNum(w.totalUnits),
              fmtPitchNum(w.storeWeeks),
              w.offset >= 0 ? fmtPitchPct(w.liftPct, true) : "Baseline",
            ]),
            alignRightCols: new Set([1, 2, 3, 4]),
          }),
        );
      }
    } else {
      const top = (data.topStoreWins || []).slice(0, 6);
      const chartPng = await renderBarChartPng({
        bars: top.map((s) => ({
          label: String(s.storeLabel || "Store"),
          value: Number(s.adjustedRegisterUnits ?? s.repObservedUnits ?? 0),
          badge: `${fmtPitchNum(s.samplesDistributed)} smp`,
          highlight: true,
        })),
        accentHex: accent,
        yLabel: "Top door units sold (POS register or rep-observed)",
      });
      if (chartPng) {
        const rId = registerMedia(ctx, slideImages, chartPng, "png");
        parts.push(
          rectShape({
            id: nextId(),
            name: "VelocityChartCard",
            x: 0.65,
            y: 1.65,
            w: 12.03,
            h: 4.5,
            fill: CARD_HEX,
            border: BORDER_HEX,
            rounded: true,
          }),
          picShape({
            id: nextId(),
            name: "VelocityChartPng",
            rId,
            x: 0.9,
            y: 1.8,
            w: 11.5,
            h: 4.2,
          }),
        );
      }
      parts.push(
        textBox({
          id: nextId(),
          name: "HaloNote",
          x: 0.65,
          y: 6.3,
          w: 12.03,
          h: 0.4,
          text:
            halo?.note ||
            "Connect retailer POS feeds spanning demo and post-demo weeks to measure 2–4 week velocity halo.",
          fontSize: 10,
          color: MUTED_HEX,
        }),
      );
    }
  } else if (descriptor.id === "shelf") {
    const shelf = data.shelfCompliance!;
    const cards = [
      {
        label: "ON-SHELF AVAILABILITY (OSA)",
        value: fmtPitchPct(shelf.osaRatePct),
        detail: `${shelf.onShelfCount} of ${shelf.auditedVisits} audited visits on shelf`,
        ok: (shelf.osaRatePct ?? 0) >= 85,
      },
      {
        label: "PRICE TAG COMPLIANCE",
        value: fmtPitchPct(shelf.priceTagRatePct),
        detail: `${shelf.priceTagVisibleCount} visits with legible shelf tag`,
        ok: (shelf.priceTagRatePct ?? 0) >= 80,
      },
      {
        label: "AVERAGE FACINGS",
        value: shelf.avgFacings != null ? `${shelf.avgFacings}` : "—",
        detail: "Observed front facings per audited shelf",
        ok: true,
      },
      {
        label: "MEDIAN SHELF PRICE",
        value: shelf.medianPrice ? `$${shelf.medianPrice}` : "—",
        detail:
          shelf.oosGapsFlagged > 0
            ? `${shelf.oosGapsFlagged} OOS gap${shelf.oosGapsFlagged === 1 ? "" : "s"} flagged`
            : "0 out-of-stock gaps flagged",
        ok: shelf.oosGapsFlagged === 0,
      },
    ];
    cards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.65 + col * 6.15;
      const y = 1.75 + row * 2.35;
      parts.push(
        rectShape({
          id: nextId(),
          name: `ShelfCard${idx}`,
          x,
          y,
          w: 5.88,
          h: 2.05,
          fill: CARD_HEX,
          border: BORDER_HEX,
          rounded: true,
        }),
        textBox({
          id: nextId(),
          name: `ShelfLbl${idx}`,
          x: x + 0.25,
          y: y + 0.22,
          w: 5.38,
          h: 0.3,
          text: c.label,
          fontSize: 9.5,
          bold: true,
          color: MUTED_HEX,
        }),
        textBox({
          id: nextId(),
          name: `ShelfVal${idx}`,
          x: x + 0.25,
          y: y + 0.58,
          w: 5.38,
          h: 0.72,
          text: c.value,
          fontSize: 34,
          bold: true,
          color: c.ok ? OK_HEX : WARN_HEX,
        }),
        textBox({
          id: nextId(),
          name: `ShelfDet${idx}`,
          x: x + 0.25,
          y: y + 1.4,
          w: 5.38,
          h: 0.4,
          text: c.detail,
          fontSize: 11,
          color: MUTED_HEX,
        }),
      );
    });
  } else if (descriptor.id === "stores") {
    const stores = (data.topStoreWins || []).slice(0, 8);
    const headers = [
      "Store",
      "Banner / Market",
      "Visits",
      "Samples",
      "Rep Units",
      "Register POS",
      "Field Highlight",
    ];
    const rows = stores.map((s) => [
      clip(s.storeLabel || "Store", 28),
      clip([s.retailerBanner, s.market].filter(Boolean).join(" · ") || "—", 28),
      fmtPitchNum(s.visits),
      fmtPitchNum(s.samplesDistributed),
      fmtPitchNum(s.repObservedUnits),
      s.adjustedRegisterUnits != null ? fmtPitchNum(s.adjustedRegisterUnits) : "—",
      clip(s.highlight || "—", 46),
    ]);
    parts.push(
      tableShape({
        id: nextId(),
        name: "TopStoreWinsTable",
        x: 0.65,
        y: 1.65,
        w: 12.03,
        h: 5.0,
        colWidths: [2.25, 2.15, 0.75, 1.05, 1.05, 1.15, 3.63],
        headers,
        rows,
        alignRightCols: new Set([2, 3, 4, 5]),
      }),
    );
  } else if (descriptor.id === "voice") {
    const voice = data.shopperVoice!;
    const quotes = (
      voice.quotes?.length
        ? voice.quotes
        : (voice.themes || [])
            .filter((t) => t.quote)
            .map((t) => ({
              section: t.section,
              label: `${t.label} (${t.recapCount} recaps)`,
              quote: t.quote || "",
            }))
    ).slice(0, 6);

    quotes.forEach((q, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.65 + col * 6.15;
      const y = 1.65 + row * 1.72;
      const badgeBg = q.section === "liked" ? OK_BG_HEX : SOFT_BG_HEX;
      const badgeInk = q.section === "liked" ? OK_HEX : MUTED_HEX;
      parts.push(
        rectShape({
          id: nextId(),
          name: `QuoteCard${idx}`,
          x,
          y,
          w: 5.88,
          h: 1.52,
          fill: CARD_HEX,
          border: BORDER_HEX,
          rounded: true,
        }),
        rectShape({
          id: nextId(),
          name: `QuoteBadge${idx}`,
          x: x + 0.2,
          y: y + 0.18,
          w: 2.8,
          h: 0.28,
          fill: badgeBg,
          rounded: true,
        }),
        textBox({
          id: nextId(),
          name: `QuoteBadgeLbl${idx}`,
          x: x + 0.26,
          y: y + 0.19,
          w: 2.68,
          h: 0.26,
          text: clip(q.label || "Shopper feedback", 34).toUpperCase(),
          fontSize: 8,
          bold: true,
          color: badgeInk,
          valign: "ctr",
        }),
        textBox({
          id: nextId(),
          name: `QuoteBody${idx}`,
          x: x + 0.2,
          y: y + 0.54,
          w: 5.48,
          h: 0.86,
          text: `“${clip(q.quote, 155)}”`,
          fontSize: 11.5,
          color: INK_HEX,
          valign: "t",
        }),
      );
    });
  } else if (descriptor.id.startsWith("photos-")) {
    const photos: PitchPhoto[] =
      "photos" in descriptor ? descriptor.photos : [];
    const fetched = fetchPhotos
      ? await Promise.all(photos.map((p) => fetchImageForSlide(p.url)))
      : photos.map(() => null);

    photos.forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cw = 3.85;
      const ch = 2.48;
      const x = 0.65 + col * (cw + 0.24);
      const y = 1.65 + row * (ch + 0.22);

      parts.push(
        rectShape({
          id: nextId(),
          name: `PhotoCard${idx}`,
          x,
          y,
          w: cw,
          h: ch,
          fill: CARD_HEX,
          border: BORDER_HEX,
          rounded: true,
        }),
      );

      const imgAsset = fetched[idx];
      if (imgAsset) {
        const rId = registerMedia(ctx, slideImages, imgAsset.data, imgAsset.ext);
        parts.push(
          picShape({
            id: nextId(),
            name: `PhotoImg${idx}`,
            rId,
            x: x + 0.08,
            y: y + 0.08,
            w: cw - 0.16,
            h: 1.66,
          }),
        );
      } else {
        parts.push(
          rectShape({
            id: nextId(),
            name: `PhotoPlaceholder${idx}`,
            x: x + 0.08,
            y: y + 0.08,
            w: cw - 0.16,
            h: 1.66,
            fill: SOFT_BG_HEX,
            rounded: true,
          }),
          textBox({
            id: nextId(),
            name: `PhotoPlaceholderTxt${idx}`,
            x: x + 0.2,
            y: y + 0.68,
            w: cw - 0.4,
            h: 0.45,
            text: "In-store photo attached in live Spark link",
            fontSize: 9.5,
            color: MUTED_HEX,
            align: "ctr",
            valign: "ctr",
          }),
        );
      }

      const storeTitle = clip(p.store || p.retailer || "Store", 34);
      const cap = clip(
        p.caption || [p.market, p.eventDate].filter(Boolean).join(" · "),
        72,
      );
      parts.push(
        textBox({
          id: nextId(),
          name: `PhotoTitle${idx}`,
          x: x + 0.12,
          y: y + 1.78,
          w: cw - 0.24,
          h: 0.24,
          text: storeTitle,
          fontSize: 9.5,
          bold: true,
          color: INK_HEX,
        }),
        textBox({
          id: nextId(),
          name: `PhotoCap${idx}`,
          x: x + 0.12,
          y: y + 2.02,
          w: cw - 0.24,
          h: 0.4,
          text: cap,
          fontSize: 8.5,
          color: MUTED_HEX,
        }),
      );
    });
  }

  return { xml: slideEnvelope(parts.join("\n")), images: slideImages };
}

/**
 * Build a native 16:9 OOXML `.pptx` JSZip archive for any unlocked PitchPayload.
 */
export async function buildBuyerDeckPptxZip(
  data: PitchPayload,
  options: { fetchPhotos?: boolean } = {},
): Promise<{ zip: JSZip; slideCount: number }> {
  const plan = buildPitchSlidePlan(data);
  const accentHex = resolveDeckAccentHex(data).replace("#", "");
  const ctx: SlideBuildContext = {
    mediaCounter: 0,
    mediaFiles: [],
    accentHexNoHash: accentHex,
  };
  const fetchPhotos = options.fetchPhotos ?? true;

  const builtSlides: Array<{ xml: string; images: EmbeddedImage[] }> = [];
  for (let i = 0; i < plan.length; i++) {
    builtSlides.push(
      await buildSlideXml(
        plan[i],
        data,
        i + 1,
        plan.length,
        ctx,
        fetchPhotos,
      ),
    );
  }

  const zip = new JSZip();

  const slideOverrides = builtSlides
    .map(
      (_, i) =>
        `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    )
    .join("\n");

  const hasPng = ctx.mediaFiles.some((m) => m.ext === "png");
  const hasJpeg = ctx.mediaFiles.some((m) => m.ext === "jpeg");

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${hasPng ? '<Default Extension="png" ContentType="image/png"/>' : ""}
  ${hasJpeg ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ""}
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${slideOverrides}
</Types>`,
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  );

  const nowIso = new Date().toISOString();
  const titleText = xmlEsc(data.title || "Buyer Pitch Deck");
  const brandText = xmlEsc(data.brandName || data.brand?.name || "Spark");

  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${titleText}</dc:title>
  <dc:creator>${brandText} via Spark</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>
</cp:coreProperties>`,
  );

  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Spark Retail Buyer QBR Generator</Application>
  <Slides>${builtSlides.length}</Slides>
</Properties>`,
  );

  const sldIdLst = builtSlides
    .map((_, i) => `    <p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
    .join("\n");

  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/>
  <p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/>
</p:presentation>`,
  );

  const slideRels = builtSlides
    .map(
      (_, i) =>
        `  <Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
    )
    .join("\n");

  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${slideRels}
</Relationships>`,
  );

  zip.file(
    "ppt/slideMasters/slideMaster1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`,
  );

  zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  );

  zip.file(
    "ppt/slideLayouts/slideLayout1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`,
  );

  zip.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  );

  zip.file(
    "ppt/theme/theme1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Spark Editorial">
  <a:themeElements>
    <a:clrScheme name="Spark">
      <a:dk1><a:srgbClr val="14160F"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="5C6154"/></a:dk2>
      <a:lt2><a:srgbClr val="F6F6F2"/></a:lt2>
      <a:accent1><a:srgbClr val="${accentHex}"/></a:accent1>
      <a:accent2><a:srgbClr val="2B4C08"/></a:accent2>
      <a:accent3><a:srgbClr val="A8340F"/></a:accent3>
      <a:accent4><a:srgbClr val="5C6154"/></a:accent4>
      <a:accent5><a:srgbClr val="DCDDD5"/></a:accent5>
      <a:accent6><a:srgbClr val="14160F"/></a:accent6>
      <a:hlink><a:srgbClr val="2B4C08"/></a:hlink>
      <a:folHlink><a:srgbClr val="5C6154"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Spark">
      <a:majorFont><a:latin typeface="Helvetica Neue"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Helvetica Neue"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Spark">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`,
  );

  builtSlides.forEach((slide, i) => {
    const num = i + 1;
    zip.file(`ppt/slides/slide${num}.xml`, slide.xml);
    zip.file(`ppt/slides/_rels/slide${num}.xml.rels`, slideRelsXml(slide.images));
  });

  for (const media of ctx.mediaFiles) {
    zip.file(media.path, media.data);
  }

  return { zip, slideCount: builtSlides.length };
}

/**
 * Generate and download a native PowerPoint `.pptx` file in the browser.
 */
export async function downloadBuyerDeckPptx(data: PitchPayload): Promise<number> {
  const { zip, slideCount } = await buildBuyerDeckPptxZip(data, {
    fetchPhotos: true,
  });
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeDeckFilename(data.title);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return slideCount;
}
