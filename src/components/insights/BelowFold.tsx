import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mount children only after they scroll near the viewport (or immediately
 * when IntersectionObserver is unavailable). Used on Insights to defer
 * heavy geo Relay queries until below the fold.
 */
export default function BelowFold({
  children,
  rootMargin = "240px",
  fallback = null,
}: {
  children: ReactNode;
  rootMargin?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [rootMargin, visible]);

  return <div ref={ref}>{visible ? children : fallback}</div>;
}
