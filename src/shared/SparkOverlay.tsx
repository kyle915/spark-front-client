import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SPARK_SPRING_DURATION_S,
  SPARK_SPRING_EASE,
  jumpOriginCss,
  type JumpOrigin,
} from "@/motion/opsMotion";

export type SparkOverlaySize = "sm" | "md" | "lg";

const SIZE: Record<SparkOverlaySize, string> = {
  sm: "spark-overlay-panel-sm",
  md: "",
  lg: "spark-overlay-panel-lg",
};

/**
 * Compact ops overlay: dim scrim fades; the panel scale+fades from the
 * trigger. Not a full-screen takeover. Escape closes; focus-visible rings
 * via opsMotion / Soft X CSS.
 */
export function SparkOverlay({
  open = true,
  onClose,
  origin = null,
  size = "md",
  closeOnScrim = true,
  labelledBy,
  label,
  children,
}: {
  open?: boolean;
  onClose: () => void;
  origin?: JumpOrigin | null;
  size?: SparkOverlaySize;
  closeOnScrim?: boolean;
  labelledBy?: string;
  label?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="spark-overlay-scrim"
          onClick={() => {
            if (closeOnScrim) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: SPARK_SPRING_EASE }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={label}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className={`spark-overlay-panel ${SIZE[size]}`.trim()}
            style={{ transformOrigin: jumpOriginCss(origin) }}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{
              duration: SPARK_SPRING_DURATION_S,
              ease: SPARK_SPRING_EASE,
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default SparkOverlay;
