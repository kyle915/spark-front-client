/**
 * Public BA job board (`/jobs/:token`). No login: the token is the link.
 *
 * BAs tick the gigs they can work, leave name / cell / email, and are booked
 * on the spot. The booking email carries the address, clock-in link, and BA
 * materials, so this page never shows a street address or anyone else's
 * details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useParams } from "react-router";
import { TenantLogo } from "@/layout/TenantLogo.tsx";

const IGNITE_HOME = "https://igniteproductions.co";
const FALLBACK_ACCENT = "#C4D82E";
const ORANGE = "#EF5A2A";

type Brand = {
  name: string;
  label: string;
  primaryColor: string | null;
  image: string | null;
  logoUrl: string | null;
  requestUrlName: string | null;
};

type Gig = {
  id: string;
  startsAt: string;
  dateLabel: string;
  timeLabel: string;
  market: string;
  venue: string;
  typeLabel: string;
  sampling: string;
  skus: string[];
  brief: string;
  openShifts: number;
  spotsLeft: number;
  full: boolean;
};

type BoardPayload = {
  brand: Brand;
  gigs: Gig[];
  markets: string[];
  contactEmail: string;
};

type ResultStatus = "booked" | "already" | "full" | "conflict" | "unavailable";

type ApplyResult = {
  id: string;
  status: ResultStatus;
  message: string;
  label?: string;
};

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

function inkOn(hex: string): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#0a0d09";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0d09" : "#ffffff";
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10})/, "");
  return digits.length === 10 && !/^[01]/.test(digits) && !/^[01]/.test(digits.slice(3));
}

function spotsCopy(gig: Gig): string {
  if (gig.full) return "Full";
  return `${gig.spotsLeft} of ${gig.openShifts} open`;
}

function resultStatusLabel(status: ResultStatus): string {
  switch (status) {
    case "booked":
      return "Booked";
    case "already":
      return "Already booked";
    case "full":
      return "Full";
    case "conflict":
      return "Time conflict";
    case "unavailable":
      return "No longer open";
    default: {
      const never: never = status;
      return never;
    }
  }
}

export default function PublicJobBoard() {
  const { token = "" } = useParams<{ token: string }>();
  const origin = useMemo(apiOrigin, []);
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ApplyResult[] | null>(null);
  const [bookedEmail, setBookedEmail] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${origin}/api/public/jobs/${encodeURIComponent(token)}`);
      if (res.status === 404) {
        setLoadError("This job board link isn't active. Ask Ignite for a current one.");
        return;
      }
      if (!res.ok) {
        setLoadError("Couldn't load open gigs. Refresh to try again.");
        return;
      }
      const data = (await res.json()) as BoardPayload;
      setBoard(data);
      setSelected((prev) => new Set([...prev].filter((id) => data.gigs.some((g) => g.id === id && !g.full))));
    } catch {
      setLoadError("Couldn't reach Spark. Check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, [origin, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const brand = board?.brand ?? null;
  const accent = brand?.primaryColor || FALLBACK_ACCENT;
  const ink = inkOn(accent);
  const brandLabel = brand?.label || brand?.name || "";

  useEffect(() => {
    if (brandLabel) document.title = `${brandLabel} open shifts · Ignite`;
  }, [brandLabel]);

  const gigs = useMemo(
    () => (board?.gigs ?? []).filter((g) => !market || g.market === market),
    [board, market],
  );
  const selectedGigs = (board?.gigs ?? []).filter((g) => selected.has(g.id));

  const toggle = (gig: Gig) => {
    if (gig.full) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gig.id)) next.delete(gig.id);
      else next.add(gig.id);
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (selected.size === 0) {
      setFormError("Pick at least one gig above.");
      return;
    }
    if (name.trim().split(/\s+/).length < 2) {
      setFormError("Enter your first and last name.");
      return;
    }
    if (!validPhone(phone)) {
      setFormError("Enter a 10-digit US cell number.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError("Enter a valid email. Your booking details are sent there.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${origin}/api/public/jobs/${encodeURIComponent(token)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim(),
          note: note.trim(),
          website,
          gigIds: [...selected],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: ApplyResult[];
        email?: string;
        message?: string;
      };
      if (!res.ok) {
        setFormError(data.message || "Couldn't book that. Try again.");
        return;
      }
      setResults(data.results ?? []);
      setBookedEmail(data.email || email.trim());
      setSelected(new Set());
      window.scrollTo({ top: 0, behavior: "smooth" });
      void load();
    } catch {
      setFormError("Couldn't reach Spark. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const bookedCount = results?.filter((r) => r.status === "booked").length ?? 0;

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <header style={headerRow}>
          <a href={IGNITE_HOME} style={{ display: "inline-flex", alignItems: "center" }}>
            <img src="/legal/spark-logo.png" alt="Spark by Ignite" style={{ height: 28, width: "auto" }} />
          </a>
          {brand ? (
            <TenantLogo
              variant="header"
              tone="light"
              name={brand.name}
              requestUrlName={brand.requestUrlName}
              image={brand.image}
              logoUrl={brand.logoUrl}
            />
          ) : null}
        </header>

        {loading && !board ? (
          <div style={panel}>
            <p style={{ margin: 0, color: "#78716c" }}>Loading open gigs…</p>
          </div>
        ) : loadError ? (
          <div style={panel}>
            <p style={{ margin: 0, fontWeight: 600 }}>{loadError}</p>
          </div>
        ) : board ? (
          <>
            {results ? (
              <section style={{ ...panel, marginBottom: 20 }} aria-live="polite">
                <p style={eyebrow}>{bookedCount ? "YOU'RE BOOKED" : "NOT BOOKED"}</p>
                <h1 style={{ ...title, marginBottom: 8 }}>
                  {bookedCount
                    ? `You're on ${bookedCount} gig${bookedCount === 1 ? "" : "s"}.`
                    : "Those gigs couldn't be booked."}
                </h1>
                {bookedCount ? (
                  <p style={support}>
                    Check <strong>{bookedEmail}</strong> for the address, times, clock-in link, and BA
                    materials. Add staffing@igniteproductions.co to your contacts so it doesn't land in spam.
                  </p>
                ) : null}
                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
                  {results.map((r) => (
                    <li key={r.id} style={resultRow}>
                      <span style={{ fontWeight: 600 }}>{r.label || "Gig"}</span>
                      <span
                        style={{
                          ...pill,
                          background: r.status === "booked" ? accent : "#fdeee8",
                          color: r.status === "booked" ? ink : "#9a3412",
                        }}
                      >
                        {resultStatusLabel(r.status)}
                      </span>
                      {r.status !== "booked" ? (
                        <span style={{ flexBasis: "100%", fontSize: 13, color: "#78716c" }}>{r.message}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <button type="button" style={{ ...secondaryBtn, marginTop: 16 }} onClick={() => setResults(null)}>
                  Pick more gigs
                </button>
              </section>
            ) : null}

            <section style={{ ...panel, marginBottom: 16 }}>
              <p style={eyebrow}>{brandLabel.toUpperCase()} · OPEN SHIFTS</p>
              <h1 style={title}>Pick the gigs you can work.</h1>
              <p style={support}>
                Tap every gig you can cover, add your info at the bottom, and you're booked. Spots are
                first come, first served.
              </p>
              {board.markets.length > 1 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }} role="group" aria-label="Filter by market">
                  {["", ...board.markets].map((m) => {
                    const active = market === m;
                    return (
                      <button
                        key={m || "all"}
                        type="button"
                        onClick={() => setMarket(m)}
                        aria-pressed={active}
                        style={{
                          ...chip,
                          background: active ? "#1c1917" : "#fff",
                          color: active ? "#fff" : "#1c1917",
                          borderColor: active ? "#1c1917" : "#e7e5e4",
                        }}
                      >
                        {m || "All markets"}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>

            {gigs.length === 0 ? (
              <div style={panel}>
                <p style={{ margin: 0, fontWeight: 600 }}>No open gigs right now.</p>
                <p style={{ ...support, marginTop: 6 }}>
                  New {brandLabel} gigs show up here as they're booked. Check back soon.
                </p>
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {gigs.map((gig) => {
                  const on = selected.has(gig.id);
                  return (
                    <li key={gig.id}>
                      <button
                        type="button"
                        onClick={() => toggle(gig)}
                        disabled={gig.full}
                        aria-pressed={on}
                        style={{
                          ...gigCard,
                          borderColor: on ? accent : "#e7e5e4",
                          boxShadow: on ? `0 0 0 2px ${accent}` : gigCard.boxShadow,
                          opacity: gig.full ? 0.55 : 1,
                          cursor: gig.full ? "not-allowed" : "pointer",
                        }}
                      >
                        <span style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <span
                            aria-hidden
                            style={{
                              ...check,
                              background: on ? accent : "#fff",
                              borderColor: on ? accent : "#d6d3d1",
                              color: ink,
                            }}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                              <span style={{ fontSize: 16, fontWeight: 700 }}>{gig.dateLabel}</span>
                              <span
                                style={{
                                  ...pill,
                                  background: gig.full ? "#f5f5f4" : "#f0fdf4",
                                  color: gig.full ? "#78716c" : "#166534",
                                }}
                              >
                                {spotsCopy(gig)}
                              </span>
                            </span>
                            <span style={{ display: "block", fontSize: 14, color: "#44403c", marginTop: 2 }}>
                              {gig.timeLabel}
                            </span>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 600, marginTop: 8 }}>
                              {gig.venue}
                            </span>
                            <span style={{ display: "block", fontSize: 13, color: "#78716c", marginTop: 2 }}>
                              {[gig.market, gig.typeLabel, gig.sampling ? `${gig.sampling} samples` : ""]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {gig.skus.length ? (
                              <span style={{ display: "block", fontSize: 13, color: "#57534e", marginTop: 6 }}>
                                {gig.skus.join(", ")}
                              </span>
                            ) : null}
                            {gig.brief ? (
                              <span style={brief}>{gig.brief}</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {board.gigs.some((g) => !g.full) ? (
              <form ref={formRef} onSubmit={submit} style={{ ...panel, marginTop: 20 }} noValidate>
                <p style={eyebrow}>YOUR INFO</p>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
                  {selectedGigs.length
                    ? `Book ${selectedGigs.length} gig${selectedGigs.length === 1 ? "" : "s"}`
                    : "Pick gigs above, then book"}
                </h2>
                {selectedGigs.length ? (
                  <p style={{ ...support, marginBottom: 4 }}>
                    {selectedGigs.map((g) => `${g.dateLabel} · ${g.venue}`).join(" / ")}
                  </p>
                ) : null}
                <label style={fieldLabel}>
                  Full name
                  <input style={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="First and last name" required />
                </label>
                <label style={fieldLabel}>
                  Cell
                  <input
                    style={input}
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(305) 555-0142"
                    required
                  />
                </label>
                <label style={fieldLabel}>
                  Email
                  <input
                    style={input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@email.com"
                    required
                  />
                  <span style={hint}>Your booking email (address, times, clock-in link, BA materials) goes here.</span>
                </label>
                <label style={fieldLabel}>
                  Note <span style={{ fontWeight: 400, color: "#a8a29e" }}>(optional)</span>
                  <textarea
                    style={{ ...input, minHeight: 72, resize: "vertical" }}
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    placeholder="Anything Ignite should know"
                  />
                </label>
                <div aria-hidden style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </label>
                </div>
                {formError ? (
                  <p role="alert" style={{ color: ORANGE, fontSize: 14, margin: "12px 0 0" }}>
                    {formError}
                  </p>
                ) : null}
                <p style={{ fontSize: 12, lineHeight: 1.45, color: "#57534e", margin: "14px 0 0" }}>
                  By booking, you agree to the{" "}
                  <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy-policy" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                    Privacy Policy
                  </a>
                  , and Ignite may text you about your gigs. Msg &amp; data rates may apply. Reply STOP to opt out.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ ...primaryBtn, background: accent, color: ink, marginTop: 16, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting
                    ? "Booking…"
                    : selectedGigs.length
                      ? `Book ${selectedGigs.length} gig${selectedGigs.length === 1 ? "" : "s"}`
                      : "Book"}
                </button>
              </form>
            ) : null}

            {selectedGigs.length && !results ? (
              <div style={stickyBar}>
                <button
                  type="button"
                  style={{ ...primaryBtn, background: accent, color: ink, maxWidth: 600 }}
                  onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  {selectedGigs.length} selected · Add your info
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        <p style={footer}>
          Questions?{" "}
          <a href={`mailto:${board?.contactEmail || "staffing@igniteproductions.co"}`} style={{ color: "#78716c" }}>
            {board?.contactEmail || "staffing@igniteproductions.co"}
          </a>
          {" · "}
          <a href={IGNITE_HOME} style={{ color: "#78716c" }}>
            igniteproductions.co
          </a>
        </p>
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  minHeight: "100dvh",
  background: "#faf7f1",
  color: "#1c1917",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "40px 16px 120px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 24,
};
const panel: CSSProperties = {
  background: "#fff",
  border: "1px solid #e7e5e4",
  borderRadius: 24,
  padding: "24px 20px",
  boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
  position: "relative",
};
const eyebrow: CSSProperties = {
  margin: "0 0 6px",
  fontSize: 11,
  letterSpacing: "0.16em",
  fontWeight: 700,
  color: "#78716c",
};
const title: CSSProperties = { fontSize: 26, lineHeight: 1.15, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" };
const support: CSSProperties = { fontSize: 15, lineHeight: 1.5, color: "#57534e", margin: "8px 0 0" };
const chip: CSSProperties = {
  border: "1px solid",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  minHeight: 36,
};
const gigCard: CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "#fff",
  border: "1px solid #e7e5e4",
  borderRadius: 18,
  padding: 16,
  color: "#1c1917",
  font: "inherit",
  boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
  transition: "box-shadow 120ms ease, border-color 120ms ease",
};
const check: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  border: "2px solid",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0,
  marginTop: 1,
};
const pill: CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};
const brief: CSSProperties = {
  display: "block",
  fontSize: 13,
  lineHeight: 1.45,
  color: "#57534e",
  marginTop: 8,
  padding: "8px 10px",
  background: "#faf7f1",
  borderRadius: 10,
  whiteSpace: "pre-line",
};
const fieldLabel: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, color: "#44403c" };
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  fontSize: 16,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#14181a",
  marginTop: 6,
  outline: "none",
  fontFamily: "inherit",
};
const hint: CSSProperties = { display: "block", fontSize: 12, fontWeight: 400, color: "#78716c", marginTop: 6 };
const primaryBtn: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  minHeight: 48,
  borderRadius: 12,
  border: "none",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
const secondaryBtn: CSSProperties = {
  padding: "12px 16px",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "transparent",
  color: "#14181a",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
const resultRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 0",
  borderTop: "1px solid #f5f5f4",
};
const stickyBar: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
  background: "rgba(250, 247, 241, 0.94)",
  borderTop: "1px solid #e7e5e4",
  display: "flex",
  justifyContent: "center",
  backdropFilter: "blur(8px)",
};
const footer: CSSProperties = { marginTop: 24, textAlign: "center", fontSize: 12, color: "#a8a29e" };
