import { Drawer } from "vaul";
import type { ReactNode } from "react";

/**
 * Mobile-first bottom sheet (vaul). Prefer over centered modals on phone
 * for share / short forms. Desktop callers can still use SparkOverlay.
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
        <Drawer.Overlay
          className="fixed inset-0 z-[60]"
          style={{
            background: "rgba(10,11,13,0.55)",
            backdropFilter: "saturate(180%) blur(8px)",
          }}
        />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[61] outline-none flex flex-col"
          style={{
            maxHeight: "92dvh",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            background: "linear-gradient(180deg, var(--spark-surface), var(--spark-surface-2))",
            border: "1px solid var(--spark-border)",
            borderBottom: "none",
            boxShadow: "0 -24px 48px rgba(0,0,0,0.45)",
          }}
        >
          <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-white/20" />
          <div
            className="px-5 pb-3 pt-1"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
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
          <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export default SparkSheet;
