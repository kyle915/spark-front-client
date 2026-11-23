import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { signatureSrc } from "./retailerSignoff";

type Point = { x: number; y: number };

const INK = "#1c1917";
const PAPER = "#ffffff";

/**
 * A signature the clerk draws with a finger or a mouse.
 * The pad itself is white paper with dark ink, on a light or dark page.
 */
export function SignaturePad({
  value,
  onChange,
  helperColor = "#44403c",
}: {
  value: string;
  onChange: (next: string) => void;
  /** Helper sentence. Dark on a light page; pass a light token on dark admin chrome. */
  helperColor?: string;
}) {
  const saved = signatureSrc(value);
  const [mode, setMode] = useState<"draw" | "saved">(saved ? "saved" : "draw");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const ink = useRef(false);
  const sizeRef = useRef({ w: 320, h: 160 });

  useEffect(() => {
    if (!saved) setMode("draw");
  }, [saved]);

  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.width = "100%";
    canvas.style.height = "160px";
    const cssW = Math.max(280, Math.floor(canvas.getBoundingClientRect().width || 320));
    const cssH = 160;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    sizeRef.current = { w: cssW, h: cssH };
    ink.current = false;
  }, [mode]);

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    drawing.current = true;
  };

  const onMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ink.current = true;
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (ink.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    if (ctx) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.strokeStyle = INK;
    }
    ink.current = false;
    onChange("");
  };

  const buttonStyle: CSSProperties = {
    marginTop: 8,
    minHeight: 44,
    padding: "8px 14px",
    borderRadius: 12,
    border: `1px solid ${INK}`,
    background: PAPER,
    color: INK,
    font: "inherit",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  if (mode === "saved" && saved) {
    return (
      <div data-signoff="signature">
        <img
          src={saved}
          alt="Store clerk signature"
          style={{
            display: "block",
            width: "100%",
            maxHeight: 160,
            objectFit: "contain",
            background: PAPER,
            border: `1px solid ${INK}`,
            borderRadius: 12,
          }}
        />
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            onChange("");
            setMode("draw");
          }}
        >
          Sign again
        </button>
      </div>
    );
  }

  return (
    <div data-signoff="signature">
      <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.45, color: helperColor }}>
        Sign with a finger or a mouse.
      </p>
      <canvas
        ref={canvasRef}
        aria-label="Signature. Draw with a finger or a mouse."
        style={{
          display: "block",
          width: "100%",
          height: 160,
          touchAction: "none",
          background: PAPER,
          border: `1px solid ${INK}`,
          borderRadius: 12,
          cursor: "crosshair",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <button type="button" style={buttonStyle} onClick={clear}>
        Clear
      </button>
    </div>
  );
}
