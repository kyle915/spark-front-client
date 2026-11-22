import { Drawer } from "vaul";
import type { ReactNode } from "react";

/**
 * Mobile-first bottom sheet or desktop right-edge slide-over drawer (vaul).
 * Prefer over centered modals for store profiles, wave builders, and share flows.
 */
export function SparkSheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  side = "bottom",
  size = "md",
  headerActions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow?: string;
  side?: "bottom" | "right";
  size?: "md" | "lg";
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const isRight = side === "right";
  const contentClass = isRight
    ? `spark-sheet-content spark-sheet-content--right${
        size === "lg" ? " spark-sheet-content--right-lg" : ""
      } outline-none flex flex-col`
    : "spark-sheet-content outline-none flex flex-col";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={isRight ? "right" : "bottom"}
      shouldScaleBackground={!isRight}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="spark-sheet-scrim" />
        <Drawer.Content className={contentClass}>
          {!isRight ? <div className="spark-sheet-handle" aria-hidden /> : null}
          <div
            className={`spark-sheet-header flex items-center gap-3${
              isRight ? " pt-4 pb-3 px-5" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <Drawer.Description className="spark-sheet-eyebrow mono text-[10px] mb-0.5 uppercase">
                  {eyebrow}
                </Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{title}</Drawer.Description>
              )}
              <Drawer.Title className="spark-sheet-title display font-bold truncate">
                {title}
              </Drawer.Title>
            </div>
            {headerActions ? (
              <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
            ) : null}
            <button
              type="button"
              className="spark-sheet-close mono text-[11px] shrink-0 px-2.5 py-2 rounded-lg"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              ✕
            </button>
          </div>
          <div
            className={`spark-sheet-body overflow-y-auto flex-1${
              isRight ? " px-5 py-4" : ""
            }`}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export default SparkSheet;
