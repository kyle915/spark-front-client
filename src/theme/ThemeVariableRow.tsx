import { useState, useRef, useEffect } from "react";
import { SketchPicker, type ColorResult } from "react-color";
import type { TenantThemeVariableKey } from "@utils/tenantThemeConfig";
import { TENANT_THEME_LABELS } from "@utils/tenantThemeConfig";

function cssToHex(value: string, fallback = "#000000"): string {
  if (!value) return fallback;

  const el = document.createElement("div");
  el.style.background = value;
  el.style.position = "absolute";
  el.style.left = "-9999px";
  document.body.appendChild(el);

  const computed = getComputedStyle(el).backgroundColor;
  document.body.removeChild(el);

  const match = computed.match(/\d+/g);
  if (!match || match.length < 3) return fallback;

  const [r, g, b] = match.map(Number);

  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

type Props = {
  variableKey: TenantThemeVariableKey;
  value: string;
  defaultValue: string;
  onChange: (key: TenantThemeVariableKey, value: string) => void;
  onReset: (key: TenantThemeVariableKey) => void;
};

export function ThemeVariableRow({
  variableKey,
  value,
  defaultValue,
  onChange,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const isDirty = value.trim() !== defaultValue.trim();

  // 👉 COLOR REAL PARA LA UI (OKLCH / HSL / RGB)
  const cssColor = value?.trim() || defaultValue;

  // 👉 COLOR SOLO PARA SketchPicker
  const hexColor = cssToHex(cssColor);

  // Cerrar picker al hacer click afuera
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleColorChange = (color: ColorResult) => {
    // SketchPicker devuelve HEX → guardamos HEX
    onChange(variableKey, color.hex);
  };

  const handleReset = () => {
    onReset(variableKey);
    setOpen(false);
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-base-content">
            {TENANT_THEME_LABELS[variableKey]}
          </div>
          <div className="text-xs opacity-70">{variableKey}</div>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-ghost border border-base-300"
          onClick={handleReset}
          disabled={!isDirty}
        >
          Reset
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Color swatch */}
        <button
          type="button"
          className="w-10 h-10 rounded-lg border border-base-300"
          style={{ background: cssColor }}
          onClick={() => setOpen((v) => !v)}
          title="Open color picker"
        />

        {/* Text input */}
        <input
          className="input input-bordered w-full font-mono text-sm"
          value={value}
          onChange={(e) => onChange(variableKey, e.target.value)}
          placeholder={defaultValue}
        />
      </div>

      {/* Color picker */}
      {open && (
        <div ref={popoverRef} className="relative z-50 mt-2 inline-block">
          <SketchPicker
            color={hexColor}
            onChange={handleColorChange}
            disableAlpha
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 text-xs">
        <div className="opacity-70">
          Default:&nbsp;
          <code className="bg-base-200 px-2 py-1 rounded">{defaultValue}</code>
        </div>
      </div>
    </div>
  );
}
