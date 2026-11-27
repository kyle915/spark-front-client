import { useEffect, useState } from "react";
import {
  shortTenantName,
  tenantInitials,
  tenantLogoCandidates,
  tenantLogoPlate,
  type TenantLogoInput,
} from "./tenantLogo";

type TenantLogoProps = TenantLogoInput & {
  active?: boolean;
  /** `chip` is the 20×20 sidebar mark. `header` is a full-color form header mark. */
  variant?: "chip" | "header";
  /** Header fallback text: `dark` for spark-form chrome, `light` for cream check-in. */
  tone?: "dark" | "light";
};

/**
 * Tenant mark. API `image` / `logoUrl` first, official fallback second.
 * Chip: 20×20 on a light plate for the dark sidebar. Header: full-color
 * header-sized mark (no invert) so it reads on a white form page.
 */
export function TenantLogo({
  active = false,
  variant = "chip",
  tone = "dark",
  ...input
}: TenantLogoProps) {
  const candidates = tenantLogoCandidates(input);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates[0], candidates[1], input.name, input.image, input.logoUrl]);

  const src = candidates[index] ?? null;
  const label = shortTenantName(input.name);
  const api = (input.logoUrl ?? input.image)?.trim() ?? "";
  const usingOfficialFallback = !api || src !== api;
  const plate = tenantLogoPlate(input, usingOfficialFallback);

  if (variant === "header") {
    if (!src) {
      const headerInitials = tenantInitials(input.name);
      return (
        <span
          className="h-9 min-w-[2.25rem] px-2.5 rounded-[8px] text-xs font-semibold inline-flex items-center justify-center shrink-0"
          style={{
            background: tone === "light" ? "#f5f5f0" : "var(--spark-surface-2)",
            color: tone === "light" ? "#1c1917" : "var(--spark-text)",
            boxShadow:
              tone === "light"
                ? "inset 0 0 0 1px rgba(28, 25, 23, 0.14)"
                : "inset 0 0 0 1px var(--spark-border)",
          }}
          title={label}
        >
          {headerInitials || label}
        </span>
      );
    }

    return (
      <span
        className={[
          "h-9 max-w-[10rem] px-2 rounded-[8px] overflow-hidden shrink-0 flex items-center justify-center",
          plate === "dark" ? "bg-black" : "bg-white",
        ].join(" ")}
        style={{
          boxShadow: "inset 0 0 0 1px rgba(var(--spark-ink-rgb, 20, 22, 15), 0.12)",
        }}
      >
        <img
          src={src}
          alt={label}
          className="h-7 w-auto max-w-[9rem] object-contain"
          onError={() => setIndex((i) => i + 1)}
        />
      </span>
    );
  }

  const initials = tenantInitials(input.name);

  if (!src) {
    return (
      <span
        className={[
          "w-5 h-5 rounded-[6px] text-[10px] font-semibold flex items-center justify-center shrink-0",
          active
            ? "bg-primary/25 text-primary"
            : "bg-base-300 text-base-content/65",
        ].join(" ")}
        style={{
          boxShadow: "inset 0 0 0 1px rgba(var(--spark-ink-rgb, 255, 255, 255), 0.14)",
        }}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={[
        "w-5 h-5 rounded-[6px] overflow-hidden shrink-0 flex items-center justify-center",
        plate === "dark" ? "bg-black" : "bg-white/95",
      ].join(" ")}
      style={{
        boxShadow: "inset 0 0 0 1px rgba(var(--spark-ink-rgb, 255, 255, 255), 0.14)",
      }}
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-contain"
        onError={() => setIndex((i) => i + 1)}
      />
    </span>
  );
}

export default TenantLogo;
