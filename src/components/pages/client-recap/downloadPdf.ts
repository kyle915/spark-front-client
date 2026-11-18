import { base64ToBytes } from "./clientRecapDraft";

/** Save a base64 PDF from the server as a file. */
export const downloadPdf = (base64: string, filename: string): void => {
  const bytes = base64ToBytes(base64);
  const href = URL.createObjectURL(
    new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
};
