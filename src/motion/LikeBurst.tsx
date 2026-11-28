import React, { useEffect, useRef, useState } from "react";

/**
 * Like Burst — wraps a photo pin / deck-selection control with a crisp
 * expanding lime ring + spring pop whenever `active` transitions false -> true.
 */
export const LikeBurst: React.FC<{
  active: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ active, className = "", style, children }) => {
  const prevActive = useRef(active);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (active && !prevActive.current) {
      setBurstKey((k) => k + 1);
    }
    prevActive.current = active;
  }, [active]);

  return (
    <span
      className={`relative inline-flex items-center justify-center ${burstKey > 0 && active ? "spark-like-pop" : ""} ${className}`.trim()}
      style={style}
    >
      {burstKey > 0 && active ? (
        <span key={burstKey} className="spark-like-burst-ring" aria-hidden />
      ) : null}
      {children}
    </span>
  );
};

export default LikeBurst;
