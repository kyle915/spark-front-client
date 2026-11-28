import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Minimize2, MonitorPlay } from "lucide-react";
import {
  isPresentModeActive,
  PRESENT_EVENT,
  resolvePresentModeKey,
  setPresentMode,
  togglePresentMode,
} from "./presentMode";

/**
 * One-click boardroom / buyer QBR Presentation Mode (`⌘⇧P`, `Esc` to exit).
 * Collapses app sidebar/topbar and secondary chrome via `html[data-spark-present="true"]`
 * and cleans up automatically on unmount.
 */
export const PresentModeControl: React.FC<{
  className?: string;
}> = ({ className = "" }) => {
  const [presenting, setPresenting] = useState<boolean>(() =>
    isPresentModeActive(),
  );

  useEffect(() => {
    const sync = () => setPresenting(isPresentModeActive());
    window.addEventListener(PRESENT_EVENT, sync);
    return () => {
      window.removeEventListener(PRESENT_EVENT, sync);
      if (isPresentModeActive()) {
        setPresentMode(false);
      }
    };
  }, []);

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      const action = resolvePresentModeKey({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        isPresent: isPresentModeActive(),
        isTypingTarget: isTypingTarget(e.target),
      });
      if (!action) return;
      e.preventDefault();
      if (action === "toggle") togglePresentMode();
      else setPresentMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-pressed={presenting}
        onClick={() => togglePresentMode()}
        title="Toggle full-bleed Present Mode (⌘⇧P)"
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition print:hidden ${className}`.trim()}
        style={{
          border: presenting
            ? "1px solid var(--spark-lime)"
            : "1px solid var(--spark-border)",
          background: presenting
            ? "var(--spark-lime)"
            : "var(--spark-surface)",
          color: presenting
            ? "var(--spark-on-accent)"
            : "var(--spark-text)",
        }}
      >
        <MonitorPlay size={13.5} strokeWidth={1.9} />
        <span>{presenting ? "Presenting" : "Present"}</span>
      </button>

      {presenting && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed bottom-5 right-5 z-50 print:hidden">
              <button
                type="button"
                onClick={() => setPresentMode(false)}
                className="px-3.5 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition hover:opacity-95"
                style={{
                  background: "var(--spark-surface, #0f1310)",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
                }}
              >
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--spark-lime)" }}
                />
                <span>Presenting</span>
                <kbd className="mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--spark-border)] opacity-75">
                  Esc
                </kbd>
                <Minimize2 size={12.5} strokeWidth={1.9} />
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default PresentModeControl;
