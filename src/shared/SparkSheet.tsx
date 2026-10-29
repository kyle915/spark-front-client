import { Drawer } from "vaul";
import type { ReactNode } from "react";

/**
 * Mobile-first bottom sheet (vaul). Prefer over centered modals on phone
 * for share / short forms. Desktop callers can still use SparkOverlay.
 * Springy ops motion via `--spark-spring` — not Liquid Glass / white iOS.
 */
export function SparkSheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="spark-sheet-scrim" />
        <Drawer.Content className="spark-sheet-content outline-none flex flex-col">
          <div className="spark-sheet-handle" aria-hidden />
          <div
            className="px-5 pb-3 pt-1 flex items-start gap-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <Drawer.Description
                  className="mono text-[10px] mb-1"
                  style={{
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {eyebrow}
                </Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{title}</Drawer.Description>
              )}
              <Drawer.Title
                className="display text-xl font-bold truncate"
                style={{ letterSpacing: "-0.02em" }}
              >
                {title}
              </Drawer.Title>
            </div>
            <button
              type="button"
              className="spark-sheet-close mono text-[11px] shrink-0 px-2.5 py-2 rounded-lg"
              style={{
                letterSpacing: "0.12em",
                minWidth: 44,
                minHeight: 44,
                color: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
              }}
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              ✕
            </button>
          </div>
          <div className="spark-sheet-body overflow-y-auto flex-1">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export default SparkSheet;
