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
      return (
        <span
          className="text-sm font-medium truncate max-w-[9rem]"
          style={{
            color: tone === "light" ? "#57534e" : "rgba(255,255,255,0.7)",
          }}
        >
          {label}
        </span>
      );
    }

    return (
      <span
        className={[
          "h-9 max-w-[10rem] px-2 rounded-md overflow-hidden shrink-0 flex items-center justify-center",
          plate === "dark" ? "bg-black" : "bg-white",
        ].join(" ")}
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
          "w-5 h-5 rounded-sm text-[10px] font-bold flex items-center justify-center shrink-0",
          active
            ? "bg-primary/30 text-primary"
            : "bg-base-300 text-base-content/55",
        ].join(" ")}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={[
        "w-5 h-5 rounded-sm overflow-hidden shrink-0 flex items-center justify-center",
        plate === "dark" ? "bg-black" : "bg-white/95",
      ].join(" ")}
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
