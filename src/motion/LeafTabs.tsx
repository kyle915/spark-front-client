import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface LeafTabOption<T extends string> {
  key: T;
  label: React.ReactNode;
  title?: string;
}

/**
 * Leaf Tabs — segmented Studio pill bar with a smooth sliding active-pill
 * indicator (measured via offsetLeft/offsetWidth + ResizeObserver).
 * Preserves `.pill-group` and `.pill-btn` visual tokens across light & dark mode.
 */
export function LeafTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: readonly LeafTabOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    visible: boolean;
  }>({ left: 0, width: 0, visible: false });

  const measure = useCallback(() => {
    const activeEl = buttonRefs.current[value];
    if (!activeEl) {
      setIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    setIndicator({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
      visible: activeEl.offsetWidth > 0,
    });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure, options]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`pill-group spark-leaf-tabs ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="spark-leaf-indicator"
        style={{
          width: indicator.width,
          transform: `translateX(${indicator.left}px)`,
          opacity: indicator.visible ? 1 : 0,
        }}
      />
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            ref={(node) => {
              buttonRefs.current[opt.key] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.title}
            onClick={() => onChange(opt.key)}
            className={`pill-btn spark-leaf-tab-btn whitespace-nowrap ${active ? "on" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default LeafTabs;
