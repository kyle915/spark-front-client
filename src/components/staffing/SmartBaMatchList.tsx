export type SmartBaMatchRow = {
  baId: string;
  name: string;
  score: number;
  summaryReason: string;
  reasons: ReadonlyArray<string>;
  isFavorited?: boolean;
  isAvailable?: boolean | null;
  brandCertified?: boolean;
  brandGigs?: number;
  reliabilityRate?: number | null;
  distanceMiles?: number | null;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "BA";

export type SmartBaMatchListProps = {
  matches: ReadonlyArray<SmartBaMatchRow>;
  /** Dark ops chrome (modal) vs lighter surfaces */
  surface?: "ops" | "light";
  rankOffset?: number;
  done?: ReadonlySet<string>;
  pendingIds?: ReadonlySet<string>;
  onSelect?: (baId: string, name: string) => void;
  actionVerb?: string;
};

const FOREST = "#14532d";
const FOREST_MUTED = "#166534";

/**
 * Ranked smart-match list with transparent summary + reason chips.
 * Lime accent is reserved for dark ops surfaces; light surfaces use deep forest tones.
 */
export const SmartBaMatchList: React.FC<SmartBaMatchListProps> = ({
  matches,
  surface = "ops",
  rankOffset = 0,
  done,
  pendingIds,
  onSelect,
  actionVerb = "Assign",
}) => {
  if (matches.length === 0) return null;

  const onOps = surface === "ops";
  const accent = onOps ? "var(--spark-lime)" : FOREST;
  const accentMuted = onOps ? "rgba(var(--spark-accent-rgb),0.10)" : "rgba(20, 83, 45, 0.08)";
  const rankMuted = onOps ? "rgba(var(--spark-ink-rgb),0.4)" : "rgba(20, 83, 45, 0.55)";
  const summaryColor = onOps ? "var(--spark-text-secondary)" : FOREST_MUTED;

  return (
    <div className="flex flex-col">
      {matches.map((m, i) => {
        const rank = rankOffset + i + 1;
        const invited = done?.has(m.baId) ?? false;
        const busy = pendingIds?.has(m.baId) ?? false;
        const clickable = Boolean(onSelect) && !invited && !busy;

        return (
          <div
            key={m.baId}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={() => {
              if (!clickable || !onSelect) return;
              onSelect(m.baId, m.name);
            }}
            onKeyDown={(e) => {
              if (!clickable || !onSelect) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(m.baId, m.name);
              }
            }}
            className="flex items-center gap-3 px-5 py-3"
            style={{
              borderTop: "1px solid rgba(var(--spark-ink-rgb),0.04)",
              cursor: clickable ? "pointer" : "default",
              background: invited ? accentMuted : "transparent",
              opacity: invited ? 0.85 : 1,
            }}
            title={clickable ? `${actionVerb} ${m.name}` : undefined}
          >
            <span
              className="mono text-[11px] shrink-0 text-right"
              style={{
                width: 18,
                color: rank === 1 ? accent : rankMuted,
                fontWeight: rank === 1 ? 700 : 400,
              }}
            >
              {rank}
            </span>
            <div
              className="rounded-full grid place-items-center font-bold shrink-0"
              style={{
                width: 32,
                height: 32,
                background: accentMuted,
                color: accent,
                fontSize: 12,
              }}
            >
              {initials(m.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                {m.isFavorited ? (
                  <span style={{ color: accent, fontSize: 12 }} title="Favorited">
                    ★
                  </span>
                ) : null}
                <span className="truncate">{m.name}</span>
                {m.brandCertified ? (
                  <span
                    className="mono text-[9px] shrink-0 uppercase"
                    style={{
                      letterSpacing: "0.1em",
                      color: summaryColor,
                      border: `1px solid ${onOps ? "var(--spark-border)" : "rgba(20,83,45,0.25)"}`,
                      borderRadius: 999,
                      padding: "1px 6px",
                    }}
                  >
                    Brand cert
                  </span>
                ) : null}
              </p>
              {m.summaryReason ? (
                <p
                  className="text-xs mt-0.5 line-clamp-2"
                  style={{ color: summaryColor, fontWeight: 500 }}
                >
                  {m.summaryReason}
                </p>
              ) : null}
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {m.reasons.map((reason, ri) => (
                  <span
                    key={ri}
                    className="mono text-[9px] shrink-0"
                    style={{
                      letterSpacing: "0.12em",
                      color: onOps ? "var(--spark-text-secondary)" : FOREST_MUTED,
                      background: onOps
                        ? "rgba(var(--spark-ink-rgb),0.05)"
                        : "rgba(20, 83, 45, 0.06)",
                      border: `1px solid ${onOps ? "var(--spark-border)" : "rgba(20,83,45,0.2)"}`,
                      padding: "1px 6px",
                      borderRadius: 999,
                    }}
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1" style={{ width: 48 }}>
              {invited ? (
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: accent,
                  }}
                >
                  ✓ ON SHIFT
                </span>
              ) : busy ? (
                <span
                  className="mono text-[10px]"
                  style={{ letterSpacing: "0.12em", color: "var(--spark-text-meta)" }}
                >
                  …
                </span>
              ) : (
                <>
                  <span
                    className="mono text-[12px] font-bold leading-none"
                    style={{ color: accent }}
                    title={`Match score ${m.score} / 100`}
                  >
                    {m.score}
                  </span>
                  <div
                    className="h-1 w-full overflow-hidden rounded-full"
                    style={{
                      background: onOps
                        ? "rgba(var(--spark-ink-rgb),0.08)"
                        : "rgba(20, 83, 45, 0.12)",
                    }}
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, m.score))}%`,
                        background: accent,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SmartBaMatchList;