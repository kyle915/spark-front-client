import { Drawer } from "vaul";
import type { ReactNode } from "react";

/**
 * Mobile-first bottom sheet (vaul). Prefer over centered modals on phone
 * for share / short forms. Desktop callers can still use SparkOverlay.
 * Origin / coss density + springy ops motion via `--spark-spring` —
 * not Liquid Glass / white iOS, no Base UI migration.
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
          <div className="spark-sheet-header flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <Drawer.Description className="spark-sheet-eyebrow mono text-[10px] mb-0.5">
                  {eyebrow}
                </Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{title}</Drawer.Description>
              )}
              <Drawer.Title className="spark-sheet-title display font-bold truncate">
                {title}
              </Drawer.Title>
            </div>
            <button
              type="button"
              className="spark-sheet-close mono text-[11px] shrink-0 px-2.5 py-2 rounded-lg"
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
