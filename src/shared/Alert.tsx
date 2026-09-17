import { AnimatePresence, motion } from "framer-motion";
import { useAlertStore, type Alert } from "@store/alertStore";

const TONE: Record<Alert["type"], { border: string; accent: string }> = {
  success: { border: "rgba(197,245,70,0.35)", accent: "var(--spark-lime)" },
  error: {
    border: "rgba(239,90,42,0.45)",
    accent: "var(--spark-orange, #ef5a2a)",
  },
  warning: {
    border: "rgba(239,90,42,0.35)",
    accent: "var(--spark-orange, #ef5a2a)",
  },
  info: { border: "var(--spark-border)", accent: "rgba(255,255,255,0.65)" },
};

/**
 * Banner-style toasts (Sonner-adjacent feel without a second toast system).
 * Keep alertStore — just quieter motion + hairline chrome.
 */
export default function Alert() {
  const { alerts, removeAlert } = useAlertStore();
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {alerts.map((alert: Alert) => {
          const tone = TONE[alert.type] ?? TONE.info;
          return (
            <motion.button
              key={alert.id}
              type="button"
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => removeAlert(alert.id)}
              className="pointer-events-auto text-left max-w-sm px-4 py-3 text-sm font-semibold"
              style={{
                borderRadius: 14,
                background: "rgba(17,20,14,0.92)",
                border: `1px solid ${tone.border}`,
                backdropFilter: "saturate(180%) blur(16px)",
                WebkitBackdropFilter: "saturate(180%) blur(16px)",
                color: "var(--spark-text, #f2f3ee)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
              }}
            >
              <span style={{ color: tone.accent }}>{alert.message}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
