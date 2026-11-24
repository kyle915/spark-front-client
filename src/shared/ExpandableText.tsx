import { useState } from "react";
import { clipAtWord, isClipped } from "@/utils/clipText";

/**
 * Long free text (a BA's quote or field note) shown clipped on a word
 * boundary, with a "Show more" / "Show less" toggle — the reader can always
 * get to the whole thing instead of a fragment that stops mid-word.
 */
export function ExpandableText({
  text,
  limit = 220,
  className = "",
}: {
  text: string;
  limit?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = isClipped(text, limit);
  const shown = open || !long ? text.replace(/\s+/g, " ").trim() : clipAtWord(text, limit);
  return (
    <span className={className}>
      {shown}
      {long ? (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium underline underline-offset-2"
            style={{ color: "var(--spark-text-secondary, var(--spark-text-meta))" }}
            aria-expanded={open}
          >
            {open ? "Show less" : "Show more"}
          </button>
        </>
      ) : null}
    </span>
  );
}

export default ExpandableText;
