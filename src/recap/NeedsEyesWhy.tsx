/**
 * One line under a Needs Eyes recap. Clean rows pass an empty string and
 * render nothing. The sentence is staff-only prose; it does not change
 * the Clean / Needs Eyes label.
 */
export function NeedsEyesWhy({ text }: { text?: string | null }) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return (
    <p
      className="relative z-10 text-[12px] leading-snug mt-1"
      style={{ color: "var(--spark-text-secondary)" }}
    >
      {clean}
    </p>
  );
}
