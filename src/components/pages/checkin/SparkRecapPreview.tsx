/**
 * /checkin/<code>/preview?program=<eventTypeId> — the no-login recap preview
 * the shift reminder email links to.
 *
 * Read-only: shows the "Before your shift" checklist and every recap question
 * so a BA knows what to collect before the demo. It never identifies anyone,
 * clocks in, or creates an event. Works offline once loaded (the check-in
 * service worker keeps the page shell and the last preview answer; this page
 * also keeps a copy in localStorage).
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { TenantLogo } from "@/layout/TenantLogo.tsx";
import { FALLBACK_ACCENT } from "./checkinHelpers";
import { h2, primaryBtn, wrap } from "./checkinStyles";
import { RecapPreviewContent } from "./RecapPreview";
import { PREVIEW_INTRO, PREVIEW_TITLE, loadRecapPreview, type PreviewLoad } from "./recapPreviewModel";
import { timedFetch } from "./timedFetch";

type PageState = { kind: "loading" } | PreviewLoad;

export default function SparkRecapPreview() {
  const { code = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const program = params.get("program") || null;
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    if (!code) return;
    let live = true;
    setState({ kind: "loading" });
    void loadRecapPreview(code, program, timedFetch).then((res) => {
      if (live) setState(res);
    });
    return () => {
      live = false;
    };
  }, [code, program]);

  const payload = state.kind === "ok" ? state.payload : null;
  const brand = payload?.brand ?? null;
  const accent = brand?.primaryColor || FALLBACK_ACCENT;

  useEffect(() => {
    const name = brand?.name ? `${brand.name} recap preview` : PREVIEW_TITLE;
    document.title = name;
  }, [brand?.name]);

  const pickProgram = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("program", id);
    else next.delete("program");
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <img src="/legal/spark-logo.png" alt="Spark by Ignite" style={{ height: 38, width: "auto" }} />
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

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", lineHeight: 1.15 }}>
          {PREVIEW_TITLE}
        </h1>
        <p style={{ color: "#44403c", fontSize: 13, margin: "0 0 16px", lineHeight: 1.45 }}>
          {PREVIEW_INTRO}
        </p>

        {state.kind === "loading" ? (
          <p role="status" style={{ fontSize: 15, color: "#57534e" }}>
            Loading the recap…
          </p>
        ) : state.kind === "error" ? (
          <p role="alert" style={{ fontSize: 15, color: "#9a3412", lineHeight: 1.45 }}>
            {state.message}
          </p>
        ) : (
          <RecapPreviewContent
            payload={state.payload}
            accent={accent}
            offline={state.offline}
            onPickProgram={pickProgram}
          />
        )}

        {code && state.kind !== "error" ? (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ ...h2, fontSize: 15 }}>On the day of your shift</h2>
            <p style={{ fontSize: 13, color: "#44403c", margin: "4px 0 10px", lineHeight: 1.45 }}>
              Check in from the same link to clock in, clock out, and file this recap.
            </p>
            <a
              href={`/checkin/${encodeURIComponent(code)}`}
              style={{
                ...primaryBtn(accent),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
            >
              Go to check-in
            </a>
          </section>
        ) : null}

        <p style={{ fontSize: 12, color: "#78716c", marginTop: 22, textAlign: "center" }}>
          Spark by Ignite
        </p>
      </div>
    </div>
  );
}
