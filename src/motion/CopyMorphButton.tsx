import React, { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";

/**
 * Copy Morph Button — smooth scale/check stroke morph on clipboard copy.
 */
export interface CopyMorphButtonProps {
  text?: string;
  onCopy?: () => void | Promise<void>;
  label?: string;
  copiedLabel?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number;
}

export const CopyMorphButton: React.FC<CopyMorphButtonProps> = ({
  text,
  onCopy,
  label = "Copy",
  copiedLabel = "Copied",
  title = "Copy to clipboard",
  className = "",
  style,
  iconSize = 12,
}) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async () => {
    try {
      if (onCopy) {
        await onCopy();
      } else if (text != null && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1650);
    } catch {
      // Clipboard blocked — caller handles fallback
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={`inline-flex items-center justify-center gap-1.5 transition hover:opacity-85 active:scale-[0.98] cursor-pointer ${className}`.trim()}
      style={style}
      title={title}
      aria-live="polite"
    >
      {copied ? (
        <span key="check" className="spark-copy-pop inline-flex items-center" aria-hidden>
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 16 16"
            className="spark-ops-check"
          >
            <path className="spark-ops-check-path" d="M3.2 8.2 6.4 11.4 12.8 4.6" />
          </svg>
        </span>
      ) : (
        <span key="copy" className="inline-flex items-center" aria-hidden>
          <Copy size={iconSize} strokeWidth={1.85} />
        </span>
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
};

/**
 * Code Shake Box — triggers a crisp horizontal spring shake whenever `trigger`
 * changes to a non-empty truthy value (e.g., an invalid check-in or walkup
 * code error message or an incrementing rejection counter).
 */
export const CodeShakeBox: React.FC<{
  trigger: string | number | boolean | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ trigger, className = "", style, children }) => {
  const [shakeCount, setShakeCount] = useState(() => (trigger ? 1 : 0));
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (trigger && trigger !== prevTrigger.current) {
      setShakeCount((c) => c + 1);
    }
    prevTrigger.current = trigger;
  }, [trigger]);

  return (
    <div
      key={shakeCount > 0 ? `shake-${shakeCount}` : "idle"}
      className={`${shakeCount > 0 ? "spark-code-shake" : ""} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
};
