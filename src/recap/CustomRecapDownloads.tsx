/**
 * Download bar for the custom recap view.
 *
 * - ⬇ PDF — open the most recent generated PDF (CustomRecapFile with
 *   pdf type). If none exists yet, use the Approval panel's "Rebuild
 *   PDF" first.
 * - ⬇ Photos ({n}) — zip every image-typed file and trigger a
 *   browser download. Caps at 200 files for sanity.
 * - ⬇ All files — same as photos but includes PDFs / docs / etc.
 *
 * Reuses `recapFileUrl` so relative blob paths (e.g.
 * `recaps/1779...-recap-...heic`) get bucket-prefixed before the
 * fetch.
 */
import { useState } from "react";
import { useAlertStore } from "@/store/alertStore";
import { recapFileUrl } from "@/utils/recapFileUrl";

type RecapFile = {
  id: string;
  name: string | null;
  url: string | null;
  fileType?: { name: string | null } | null;
};

interface Props {
  recapUuid: string;
  files: ReadonlyArray<RecapFile>;
}

const isImage = (f: RecapFile) => {
  const t = (f.fileType?.name ?? "").toLowerCase();
  if (t === "image" || t === "img") return true;
  if (t === "pdf") return false;
  const url = (f.url ?? "").toLowerCase().split("?")[0] ?? "";
  return /\.(jpe?g|png|gif|heic|heif|webp)$/i.test(url);
};
const isPdf = (f: RecapFile) => {
  const t = (f.fileType?.name ?? "").toLowerCase();
  const url = (f.url ?? "").toLowerCase().split("?")[0] ?? "";
  return t === "pdf" || url.endsWith(".pdf");
};

export default function CustomRecapDownloads({ recapUuid, files }: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [zipping, setZipping] = useState<"photos" | "all" | null>(null);

  const pdfs = files.filter(isPdf);
  const images = files.filter(isImage);
  const all = files.filter((f) => Boolean(f.url));
  const latestPdf = pdfs[pdfs.length - 1];

  const openPdf = () => {
    if (!latestPdf) {
      showAlert(
        'No PDF on this recap yet. Hit "Rebuild PDF" in the admin actions panel to generate one.',
        "warning",
      );
      return;
    }
    const url = recapFileUrl(latestPdf.url ?? "");
    if (!url) {
      showAlert("PDF URL is empty.", "warning");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const zip = async (mode: "photos" | "all") => {
    const subset = (mode === "photos" ? images : all).slice(0, 200);
    if (subset.length === 0) {
      showAlert("No files to download.", "warning");
      return;
    }
    setZipping(mode);
    try {
      const { default: JSZip } = await import("jszip");
      const z = new JSZip();
      let added = 0;
      for (const f of subset) {
        const url = recapFileUrl(f.url ?? "");
        if (!url) continue;
        try {
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const filename =
            (f.url ?? "").split("/").pop() || f.name || `file-${added}`;
          z.file(filename, blob);
          added += 1;
        } catch {
          /* skip individual failures */
        }
      }
      if (added === 0) {
        showAlert("Nothing downloadable — check sharing on the bucket.", "warning");
        return;
      }
      const out = await z.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const a = document.createElement("a");
      const dl = URL.createObjectURL(out);
      a.href = dl;
      a.download = `custom-recap-${recapUuid.slice(-6)}-${mode}.zip`;
      a.click();
      URL.revokeObjectURL(dl);
      showAlert(`Downloaded ${added} file(s).`, "success");
    } catch (e) {
      showAlert(`Download failed: ${(e as Error).message}`, "error");
    } finally {
      setZipping(null);
    }
  };

  const btn: React.CSSProperties = {
    background: "transparent",
    border: "1px solid var(--spark-border)",
    color: "var(--spark-text)",
    padding: "8px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
  };

  return (
    <div
      className="flex items-center gap-2 flex-wrap p-3 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <p
        className="mono text-[10px] mr-2"
        style={{
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        DOWNLOADS
      </p>
      <button
        onClick={openPdf}
        style={{
          ...btn,
          opacity: latestPdf ? 1 : 0.5,
        }}
        title={
          latestPdf
            ? `Open ${latestPdf.name ?? "the PDF"} in a new tab`
            : "No PDF yet — use Rebuild PDF in admin actions"
        }
      >
        ⬇ PDF{latestPdf ? "" : " (none)"}
      </button>
      <button
        onClick={() => zip("photos")}
        disabled={zipping !== null || images.length === 0}
        style={{
          ...btn,
          opacity: zipping !== null || images.length === 0 ? 0.5 : 1,
        }}
      >
        {zipping === "photos"
          ? `Zipping ${images.length}…`
          : `⬇ Photos (${images.length})`}
      </button>
      <button
        onClick={() => zip("all")}
        disabled={zipping !== null || all.length === 0}
        style={{
          ...btn,
          opacity: zipping !== null || all.length === 0 ? 0.5 : 1,
        }}
      >
        {zipping === "all"
          ? `Zipping ${all.length}…`
          : `⬇ All files (${all.length})`}
      </button>
      <button
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          showAlert("Link copied.", "success");
        }}
        style={btn}
      >
        🔗 Copy link
      </button>
    </div>
  );
}
