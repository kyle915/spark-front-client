import { useEffect, useRef, useState, type CSSProperties } from "react";

export function StatusMorph({
  value,
  className,
  style,
}: {
  value: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [current, setCurrent] = useState(value);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const timerRef = useRef(0);

  useEffect(() => {
    if (value === current) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOutgoing(null);
      setCurrent(value);
      return;
    }
    setOutgoing(current);
    setCurrent(value);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOutgoing(null), 240);
    return () => window.clearTimeout(timerRef.current);
  }, [value, current]);

  return (
    <span className={`spark-ops-status ${className ?? ""}`.trim()} style={style}>
      {outgoing ? (
        <span className="spark-ops-status-out" aria-hidden>
          {outgoing}
        </span>
      ) : null}
      <span className={outgoing ? "spark-ops-status-in" : undefined}>{current}</span>
    </span>
  );
}
