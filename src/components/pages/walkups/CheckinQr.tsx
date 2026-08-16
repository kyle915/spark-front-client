import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useAlertStore } from "@/store/alertStore";

/**
 * Scannable check-in QR + PNG download.
 *
 * Same canvas export as campaign receipts (`SparkReceipts` QrPanel). The URL
 * must already be the client-host check-in link — never admin, never spark.
 */
export default function CheckinQr({
  url,
  downloadName,
}: {
  url: string;
  downloadName: string;
}) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const wrapRef = useRef<HTMLDivElement>(null);

  const download = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) {
      showAlert("QR isn't ready yet — try again in a moment.", "warning");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = downloadName.endsWith(".png") ? downloadName : `${downloadName}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      showAlert("Couldn't export the QR image.", "error");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        ref={wrapRef}
        className="rounded-xl shrink-0 grid place-items-center"
        style={{ background: "#ffffff", padding: 8 }}
      >
        <QRCodeCanvas
          value={url}
          size={104}
          bgColor="#ffffff"
          fgColor="#0a0d09"
          level="M"
          marginSize={1}
        />
      </div>
      <div className="min-w-0">
        <p
          className="mono text-[10px] uppercase"
          style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}
        >
          Scan to open check-in
        </p>
        <button
          type="button"
          onClick={download}
          className="mt-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          Download QR
        </button>
      </div>
    </div>
  );
}
