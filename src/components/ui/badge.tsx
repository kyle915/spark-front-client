import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "success" | "error" | "warning" | "neutral" | "outline";
  className?: string;
}

export default function Badge({
  children,
  variant = "neutral",
  className = "",
}: BadgeProps) {
  const baseStyles =
    "px-3 py-1 text-xs font-semibold rounded-full border inline-flex items-center justify-center";

  const variants = {
    success: "bg-green-100 text-green-700 border-green-300",
    error: "bg-red-100 text-red-700 border-red-300",
    warning: "bg-amber-100 text-amber-700 border-amber-300",
    neutral: "bg-gray-100 text-gray-700 border-gray-300",
    outline: "bg-transparent text-gray-700 border-gray-400",
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)}>
      {children}
    </span>
  );
}
