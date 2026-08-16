import { useEffect, useState } from "react";
import {
  tenantInitials,
  tenantLogoCandidates,
  type TenantLogoInput,
} from "./tenantLogo";

type TenantLogoProps = TenantLogoInput & {
  active?: boolean;
};

/**
 * 20×20 tenant mark for the sidebar picker. API image first, official
 * fallback second, two-letter initials last. A light chip keeps black
 * wordmarks readable on the dark sidebar.
 */
export function TenantLogo({
  active = false,
  ...input
}: TenantLogoProps) {
  const candidates = tenantLogoCandidates(input);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates[0], candidates[1], input.name, input.image]);

  const src = candidates[index] ?? null;
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
    <span className="w-5 h-5 rounded-sm bg-white/95 overflow-hidden shrink-0 flex items-center justify-center">
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
